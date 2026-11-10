/**
 * Demo trading history: the last 7 days of closed till sessions with varied sales, cash movements and
 * a few refunds, so reports, the day end report and till session history have something real to show.
 *
 *   npm run seed:history            adds history if none exists
 *   npm run seed:history -- --reset removes the previous demo history first, then adds it again
 *
 * Everything it creates is tagged "[demo history]" on the till session, so only demo data is ever removed.
 * Product stock levels are left alone (the history acts as "already counted in").
 */
import 'reflect-metadata';
import { In } from 'typeorm';
import { AppDataSource } from '../src/infrastructure/database/data-source';
import {
  CashMovement, CashMovementType, Product, Refund, RefundDisposition, RefundReason, Restaurant, Sale, SaleItem, SalePayment, SalePaymentMethod,
  SaleStatus, Shift, ShiftStatus, Tenant, User, UserRole,
} from '../src/infrastructure/database/entities';
import { calcLine, formatReceiptNumber, round2, round3, sumLines } from '../src/sales/sale-calculations';
import { formatRefundNumber } from '../src/refunds/refund-calculations';
import { cashVariance, expectedCash } from '../src/shifts/shift-calculations';

const TAG = '[demo history]';
const DAYS = 7;

// Small deterministic generator so repeated runs give the same shape of data.
let seed = 20261110;
const rand = () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const int = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;
const pick = <T>(a: T[]): T => a[Math.floor(rand() * a.length)];

async function main() {
  const reset = process.argv.includes('--reset');
  const ds = await AppDataSource.initialize();
  const tenant = await ds.getRepository(Tenant).findOne({ where: { subdomain: 'freshmarket' } });
  if (!tenant) throw new Error('Run "npm run seed:demo" first (demo tenant not found).');
  const stores = await ds.getRepository(Restaurant).find({ where: { tenantId: tenant.id } });

  if (reset) {
    const old = await ds.getRepository(Shift).find({ where: { openingNote: TAG } });
    const ids = old.map((s) => s.id);
    if (ids.length) {
      await ds.getRepository(Refund).delete({ shiftId: In(ids) });
      await ds.getRepository(Sale).delete({ shiftId: In(ids) });
      await ds.getRepository(CashMovement).delete({ shiftId: In(ids) });
      await ds.getRepository(Shift).delete({ id: In(ids) });
      console.log(`Removed ${ids.length} earlier demo sessions`);
    }
  } else if (await ds.getRepository(Shift).count({ where: { openingNote: TAG } })) {
    console.log('Demo history already exists. Use "npm run seed:history -- --reset" to rebuild it.');
    await ds.destroy();
    return;
  }

  for (const store of stores) {
    const products = (await ds.getRepository(Product).find({ where: { storeId: store.id, isActive: true }, order: { name: 'ASC' } }));
    const staff = await ds.getRepository(User).find({ where: { restaurantId: store.id } });
    const cashiers = staff.filter((u) => u.role === UserRole.CASHIER);
    const manager = staff.find((u) => u.role === UserRole.MANAGER);
    if (!products.length || cashiers.length < 2 || !manager) { console.log(`Skipping ${store.name}: needs products, 2 cashiers and a manager`); continue; }

    const maxSeq = async (table: string, col: string) => Number((await ds.query(`SELECT COALESCE(MAX("${col}"),0) AS m FROM ${table} WHERE "storeId" = $1`, [store.id]))[0].m);
    let receiptSeq = await maxSeq('sales', 'receiptSeq');
    let refundSeq = await maxSeq('refunds', 'refundSeq');
    let salesMade = 0, shiftsMade = 0;

    for (let back = DAYS; back >= 1; back--) {
      const day = new Date(); day.setHours(0, 0, 0, 0); day.setDate(day.getDate() - back);
      const weekend = [0, 6].includes(day.getDay());
      const sessions = [
        { cashier: cashiers[0], from: 8, to: 14 },
        { cashier: cashiers[1], from: 14, to: 22 },
      ];

      for (const sess of sessions) {
        const openedAt = new Date(day); openedAt.setHours(sess.from, int(0, 10));
        const closedAt = new Date(day); closedAt.setHours(sess.to, int(0, 10));
        const floatAmt = pick([50, 100]);
        const shift = await ds.getRepository(Shift).save(ds.getRepository(Shift).create({
          storeId: store.id, userId: sess.cashier.id, cashierName: sess.cashier.name, status: ShiftStatus.CLOSED, // closed from the start: a user may only have one open session
          openedAt, closedAt, openingFloat: floatAmt, openingNote: TAG,
        }));

        const count = weekend ? int(10, 16) : int(16, 26);
        const times = Array.from({ length: count }, () => openedAt.getTime() + rand() * (closedAt.getTime() - openedAt.getTime())).sort((a, b) => a - b);
        const made: Sale[] = [];

        for (const t of times) {
          const lines = new Map<string, { p: Product; qty: number }>();
          const n = int(1, 7);
          for (let i = 0; i < n; i++) {
            const p = products[Math.floor(Math.pow(rand(), 1.4) * products.length)]; // some products sell far more than others
            const qty = p.unitType === 'weight' ? round3(0.2 + rand() * 1.3) : int(1, rand() < 0.2 ? 4 : 2);
            const cur = lines.get(p.id);
            lines.set(p.id, { p, qty: round3((cur?.qty ?? 0) + qty) });
          }
          const amounts = [...lines.values()].map(({ p, qty }) => calcLine(p.price, qty, p.vatRate));
          const totals = sumLines(amounts);
          if (totals.total <= 0) continue;

          const split = rand() < 0.08 && totals.total > 4;
          const cashFirst = rand() < 0.45;
          const payments: SalePayment[] = [];
          let changeDue = 0;
          const makeCash = (amount: number) => {
            const tendered = rand() < 0.4 ? amount : Math.ceil(amount / 5) * 5 + (rand() < 0.3 ? 5 : 0);
            changeDue = round2(changeDue + tendered - amount);
            return Object.assign(new SalePayment(), { method: SalePaymentMethod.CASH, amount, tendered, reference: null });
          };
          const makeCard = (amount: number) => Object.assign(new SalePayment(), { method: SalePaymentMethod.CARD, amount, tendered: null, reference: `AUTH${int(100000, 999999)}` });
          if (split) {
            const a = round2(Math.floor(totals.total / 2 * 100) / 100);
            payments.push(makeCard(a), makeCash(round2(totals.total - a)));
          } else payments.push(cashFirst ? makeCash(totals.total) : makeCard(totals.total));

          receiptSeq += 1;
          const items = [...lines.values()].map(({ p, qty }, i) => Object.assign(new SaleItem(), {
            productId: p.id, name: p.name, barcode: p.barcode, quantity: qty, unitPrice: p.price, vatRate: p.vatRate,
            lineTotal: amounts[i].lineTotal, vatAmount: amounts[i].vatAmount, ageRestriction: p.ageRestriction,
            originalUnitPrice: null, adjustmentReason: null, promoDiscount: 0, promotionName: null,
          }));
          const sale = await ds.getRepository(Sale).save(ds.getRepository(Sale).create({
            storeId: store.id, receiptSeq, receiptNumber: formatReceiptNumber(receiptSeq), cashierId: sess.cashier.id, cashierName: sess.cashier.name,
            shiftId: shift.id, status: SaleStatus.COMPLETED, total: totals.total, netTotal: totals.netTotal, vatTotal: totals.vatTotal, changeDue,
            itemCount: items.reduce((a, i) => a + (Number.isInteger(i.quantity) ? i.quantity : 1), 0), discountTotal: 0, pointsEarned: 0,
            ageVerified: items.some((i) => i.ageRestriction > 0), items, payments, createdAt: new Date(t),
          } as any) as any) as Sale;
          made.push(sale); salesMade++;
        }

        // A couple of refunds, handled by the manager, taken back the way the customer paid.
        let refundsTotal = 0, refundsVat = 0, cashRefunds = 0, cardRefunds = 0, refundCount = 0;
        for (const sale of made.filter(() => rand() < 0.08).slice(0, 2)) {
          const item = pick(sale.items);
          const pay = sale.payments[0];
          if (item.lineTotal > pay.amount) continue;
          item.refundedQuantity = item.quantity; item.refundedAmount = item.lineTotal; item.refundedVat = item.vatAmount;
          sale.refundedTotal = item.lineTotal;
          sale.status = sale.items.length === 1 ? SaleStatus.REFUNDED : SaleStatus.PARTIALLY_REFUNDED;
          await ds.getRepository(SaleItem).save(item);
          await ds.getRepository(Sale).save(sale);
          refundSeq += 1;
          const at = new Date(sale.createdAt.getTime() + int(5, 90) * 60000);
          await ds.getRepository(Refund).save(ds.getRepository(Refund).create({
            storeId: store.id, refundSeq, refundNumber: formatRefundNumber(refundSeq), saleId: sale.id, originalReceiptNumber: sale.receiptNumber,
            shiftId: shift.id, processedById: manager.id, processedByName: manager.name,
            reason: pick([RefundReason.DAMAGED, RefundReason.CHANGED_MIND, RefundReason.WRONG_ITEM]), note: null,
            total: item.lineTotal, vatTotal: item.vatAmount, createdAt: at,
            items: [{ saleItemId: item.id, productId: item.productId, name: item.name, quantity: item.quantity, lineTotal: item.lineTotal, vatAmount: item.vatAmount, disposition: pick([RefundDisposition.RESTOCK, RefundDisposition.WASTE]) }],
            payments: [{ method: pay.method, amount: item.lineTotal, reference: null }],
          } as any) as any);
          refundCount++; refundsTotal = round2(refundsTotal + item.lineTotal); refundsVat = round2(refundsVat + item.vatAmount);
          if (pay.method === SalePaymentMethod.CASH) cashRefunds = round2(cashRefunds + item.lineTotal); else cardRefunds = round2(cardRefunds + item.lineTotal);
        }

        // Cash movements: a float top-up, a safe drop, a few no-sale opens.
        const cashSales = round2(made.flatMap((s) => s.payments).filter((p) => p.method === SalePaymentMethod.CASH).reduce((a, p) => a + p.amount, 0));
        const cardSales = round2(made.flatMap((s) => s.payments).filter((p) => p.method === SalePaymentMethod.CARD).reduce((a, p) => a + p.amount, 0));
        const paidIn = 20;
        const safeDrops = cashSales > 120 ? 100 : 0;
        const mv = (type: CashMovementType, amount: number, reason: string, at: Date) => ds.getRepository(CashMovement).save(ds.getRepository(CashMovement).create({
          storeId: store.id, shiftId: shift.id, userId: sess.cashier.id, userName: sess.cashier.name, type, amount, reason, createdAt: at,
        }));
        await mv(CashMovementType.PAID_IN, paidIn, 'Change from safe', new Date(openedAt.getTime() + 600000));
        if (safeDrops) await mv(CashMovementType.SAFE_DROP, safeDrops, 'Drawer limit reached', new Date(openedAt.getTime() + (closedAt.getTime() - openedAt.getTime()) / 2));
        const noSales = int(1, 3);
        for (let i = 0; i < noSales; i++) await mv(CashMovementType.NO_SALE, 0, 'Change for customer', new Date(openedAt.getTime() + int(30, 300) * 60000));

        // Close the session like the real Z report does.
        const gross = round2(made.reduce((a, s) => a + s.total, 0));
        const vatSales = round2(made.reduce((a, s) => a + s.vatTotal, 0));
        const expected = expectedCash(floatAmt, cashSales, cashRefunds, { paidIn, safeDrops });
        const roll = rand();
        const variance = roll < 0.65 ? 0 : roll < 0.85 ? pick([-0.5, -1, 0.5, 1]) : pick([-3.2, 2.5, -4.1]);
        const counted = round2(expected + variance);
        Object.assign(shift, {
          status: ShiftStatus.CLOSED, closedAt, countedCash: counted, expectedCash: expected, variance: cashVariance(counted, expected),
          closeNote: Math.abs(variance) > 2 ? (variance < 0 ? 'Short: change given in error, recounted twice' : 'Over: customer left change') : null,
          transactionCount: made.length, refundCount, grossSales: gross, vatTotal: round2(vatSales - refundsVat), cashSales, cardSales,
          refundsTotal, cashRefunds, cardRefunds, paidIn, paidOut: 0, safeDrops, noSaleCount: noSales,
        });
        await ds.getRepository(Shift).save(shift);
        shiftsMade++;
      }
    }
    console.log(`${store.name}: ${shiftsMade} sessions, ${salesMade} sales`);
  }
  await ds.destroy();
}
main().catch((e) => { console.error('Seed failed:', e.message); process.exit(1); });
