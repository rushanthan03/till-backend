/**
 * Second layer of demo data, so every screen has realistic content:
 *   - 40 loyalty customers, attached to about a quarter of the demo sales (points, spend and visits add up)
 *   - offers that are live, scheduled and ended
 *   - stock history: supplier deliveries and waste over the week, plus a few low and out-of-stock products
 *   - attendance: clock in/out for every demo till session and a manager's day
 *   - pack barcodes: six-packs, cases and boxes (codes 9900…) that add several units per scan
 *   - suppliers (each product gets its usual supplier) and purchase orders: a draft, one on order and one running late
 *
 *   npm run seed:extras            adds it once (needs seed:demo and seed:history first)
 *   npm run seed:extras -- --reset removes the earlier extras and rebuilds them
 *
 * Everything is tagged ("DEMO-" stock references, "[demo history]" attendance notes, @demo.customers.test emails,
 * named offers, C0000nnnn card numbers, 9900… pack barcodes, suppliers noted "[demo history]"), so only demo data is ever removed.
 */
import 'reflect-metadata';
import { In, Like } from 'typeorm';
import { AppDataSource } from '../src/infrastructure/database/data-source';
import {
  Customer, Product, ProductBarcode, Promotion, PurchaseOrder, PurchaseOrderLine, PurchaseOrderStatus, Supplier, PromotionScope, PromotionType, Restaurant, Sale, Shift, StockMovement, StockMovementType, Tenant, TimeEntry, User, UserRole,
} from '../src/infrastructure/database/entities';
import { round2, round3 } from '../src/sales/sale-calculations';

const TAG = '[demo history]';
const EMAIL_DOMAIN = '@demo.customers.test';
// Demo customers get card numbers C0000nnnn. Real ones are generated from 10000000 up, so this range is never used for a real customer.
const DEMO_CARD = 'C0000%';
const DEMO_PACK = '9900%';
const PROMO_NAMES = ['3 for £5 Muffins', 'Dairy Week: 15% off', 'Fresh Drinks: 3 for £4', 'Summer BBQ: 20% off Meat & Fish', 'Bank Holiday Bakery: 10% off'];
const SUPPLIERS = ['Booker Wholesale', 'Bidfood', 'Fresh Direct', 'Brakes', 'Park Cakes Ltd'];

let seed = 7771;
const rand = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const int = (a: number, b: number) => Math.floor(rand() * (b - a + 1)) + a;
const pick = <T>(a: T[]): T => a[Math.floor(rand() * a.length)];

const FIRST = ['Amelia', 'Oliver', 'Priya', 'Jack', 'Fatima', 'Harry', 'Chloe', 'Mohammed', 'Grace', 'Noah', 'Aisha', 'Leo', 'Sophie', 'Arjun', 'Ella', 'Thomas', 'Zara', 'George', 'Ruby', 'Daniel', 'Isla', 'Callum', 'Maya', 'Ethan', 'Hannah', 'Liam', 'Eleanor', 'Rohan', 'Poppy', 'Samuel'];
const LAST = ['Smith', 'Patel', 'Jones', 'Khan', 'Taylor', 'Brown', 'Williams', 'Ahmed', 'Wilson', 'Evans', 'Singh', 'Thomas', 'Roberts', 'Walker', 'Hughes', 'Green', 'Hall', 'Wood', 'Clarke', 'Bennett', 'Murphy', 'Ali', 'Cooper', 'Ward', 'Moore'];

async function main() {
  const reset = process.argv.includes('--reset');
  const ds = await AppDataSource.initialize();
  const tenant = await ds.getRepository(Tenant).findOne({ where: { subdomain: 'freshmarket' } });
  if (!tenant) throw new Error('Run "npm run seed:demo" first.');
  const stores = await ds.getRepository(Restaurant).find({ where: { tenantId: tenant.id }, order: { name: 'ASC' } });
  const demoShifts = await ds.getRepository(Shift).find({ where: { openingNote: TAG } });
  if (!demoShifts.length) throw new Error('Run "npm run seed:history" first (the extras build on the demo sales).');

  const customers = ds.getRepository(Customer);
  const sales = ds.getRepository(Sale);
  const products = ds.getRepository(Product);
  const ledger = ds.getRepository(StockMovement);

  if (reset) {
    // put stock back exactly as it was before the extras, then remove them
    const mv = await ledger.find({ where: { reference: Like('DEMO-%') } });
    const byProduct = new Map<string, number>();
    mv.forEach((m) => byProduct.set(m.productId, round3((byProduct.get(m.productId) ?? 0) + m.quantity)));
    for (const [pid, delta] of byProduct) await products.increment({ id: pid }, 'stockQuantity', -delta);
    await ledger.delete({ reference: Like('DEMO-%') });
    const demoCustomers = await customers.find({ where: { cardNumber: Like(DEMO_CARD) }, select: ['id'] });
    if (demoCustomers.length) await sales.update({ customerId: In(demoCustomers.map((c) => c.id)) }, { customerId: null, customerName: null, pointsEarned: 0 });
    await customers.delete({ cardNumber: Like(DEMO_CARD) });
    await ds.getRepository(Promotion).delete({ name: In(PROMO_NAMES) });
    await ds.getRepository(TimeEntry).delete({ note: TAG });
    await ds.getRepository(ProductBarcode).delete({ barcode: Like(DEMO_PACK) });
    const demoSuppliers = await ds.getRepository(Supplier).find({ where: { tenantId: tenant.id, notes: TAG } });
    if (demoSuppliers.length) {
      const ids = demoSuppliers.map((x) => x.id);
      await ds.getRepository(PurchaseOrder).delete({ supplierId: In(ids) });
      await products.update({ supplierId: In(ids) }, { supplierId: null });
      await ds.getRepository(Supplier).delete({ id: In(ids) });
    }
    console.log('Removed earlier extras');
  } else if (await customers.count({ where: { cardNumber: Like(DEMO_CARD) } })) {
    console.log('Extras already exist. Use "npm run seed:extras -- --reset" to rebuild them.');
    await ds.destroy();
    return;
  }

  // ---------- loyalty customers ----------
  const made: Customer[] = [];
  for (let i = 0; i < 40; i++) {
    const first = FIRST[i % FIRST.length];
    const last = pick(LAST);
    made.push(customers.create({
      tenantId: tenant.id, storeId: stores[i % stores.length].id, cardNumber: `C${String(i + 1).padStart(8, '0')}`,
      name: `${first} ${last}`, phone: `07700 9${String(10000 + i * 73).slice(0, 5)}`.slice(0, 12),
      email: rand() < 0.7 ? `${first}.${last}${i}${EMAIL_DOMAIN}`.toLowerCase() : null,
      marketingConsent: rand() < 0.55,
      pointsBalance: 0, totalSpend: 0, visitCount: 0, lastVisitAt: null,
    } as any) as unknown as Customer);
  }
  const saved = await customers.save(made);

  // attach about a quarter of the demo sales to customers (mostly ones who joined at that store)
  const demoSales = await sales.find({ where: { shiftId: In(demoShifts.map((s) => s.id)) } });
  const stats = new Map<string, { points: number; spend: number; visits: number; last: Date }>();
  for (const sale of demoSales) {
    if (rand() > 0.26) continue;
    const local = saved.filter((c) => c.storeId === sale.storeId);
    const c = rand() < 0.75 ? pick(local) : pick(saved);
    const net = round2(sale.total - sale.refundedTotal);
    const pts = Math.max(0, Math.floor(sale.total) - Math.floor(sale.refundedTotal));
    sale.customerId = c.id; sale.customerName = c.name; sale.pointsEarned = Math.floor(sale.total);
    const st = stats.get(c.id) ?? { points: 0, spend: 0, visits: 0, last: sale.createdAt };
    st.points += pts; st.spend = round2(st.spend + net); st.visits += 1;
    if (sale.createdAt > st.last) st.last = sale.createdAt;
    stats.set(c.id, st);
  }
  await sales.save(demoSales.filter((s) => s.customerId));
  for (const c of saved) {
    const st = stats.get(c.id);
    if (st) Object.assign(c, { pointsBalance: st.points, totalSpend: st.spend, visitCount: st.visits, lastVisitAt: st.last });
  }
  await customers.save(saved);
  console.log(`Customers: ${saved.length} created, ${[...stats.keys()].length} with purchases`);

  // ---------- offers: live, scheduled, ended ----------
  const day = 86400000;
  for (const store of stores) {
    const ps = await products.find({ where: { storeId: store.id, isActive: true } });
    const muffin = ps.find((p) => p.name === 'Chocolate Muffin 2 Pack');
    const drink = ps.find((p) => p.department === 'Drinks' && p.unitType === 'each');
    const offer = (o: Partial<Promotion>) => ds.getRepository(Promotion).save(ds.getRepository(Promotion).create({ storeId: store.id, isActive: true, startsAt: null, endsAt: null, ...o } as any));
    if (muffin) await offer({ name: PROMO_NAMES[0], type: PromotionType.MULTIBUY, scope: PromotionScope.PRODUCT, productId: muffin.id, buyQty: 3, bundlePrice: round2(muffin.price * 3 * 0.8) });
    await offer({ name: PROMO_NAMES[1], type: PromotionType.PERCENT_OFF, scope: PromotionScope.DEPARTMENT, department: 'Dairy & Eggs', percentOff: 15, startsAt: new Date(Date.now() - 2 * day), endsAt: new Date(Date.now() + 5 * day) });
    if (drink) await offer({ name: PROMO_NAMES[2], type: PromotionType.MULTIBUY, scope: PromotionScope.PRODUCT, productId: drink.id, buyQty: 3, bundlePrice: round2(drink.price * 3 * 0.85) });
    await offer({ name: PROMO_NAMES[3], type: PromotionType.PERCENT_OFF, scope: PromotionScope.DEPARTMENT, department: 'Meat & Fish', percentOff: 20, startsAt: new Date(Date.now() + 14 * day), endsAt: new Date(Date.now() + 21 * day) });
    await offer({ name: PROMO_NAMES[4], type: PromotionType.PERCENT_OFF, scope: PromotionScope.DEPARTMENT, department: 'Bakery', percentOff: 10, startsAt: new Date(Date.now() - 10 * day), endsAt: new Date(Date.now() - 3 * day) });
  }
  console.log('Offers: 5 per store (3 running, 1 scheduled, 1 ended)');

  // ---------- stock history ----------
  for (const store of stores) {
    const ps = await products.find({ where: { storeId: store.id, isActive: true }, order: { name: 'ASC' } });
    const stock = new Map(ps.map((p) => [p.id, p.stockQuantity]));
    const start = new Map(stock); // level before any extras
    type Ev = { at: Date; product: Product; type: StockMovementType; qty: number; ref: string; supplier?: string; reason?: string; cost?: number | null };
    const events: Ev[] = [];
    let delivery = 0;
    for (let d = 6; d >= 1; d -= 2) {
      delivery++;
      const at = new Date(Date.now() - d * day); at.setHours(7, int(0, 45));
      const ref = `DEMO-GR-${store.name.includes('High') ? 'HS' : 'SR'}-${String(delivery).padStart(3, '0')}`;
      const supplier = pick(SUPPLIERS);
      for (const p of Array.from({ length: int(4, 8) }, () => pick(ps.filter((x) => x.unitType === 'each')))) {
        if (events.some((e) => e.ref === ref && e.product.id === p.id)) continue;
        events.push({ at, product: p, type: StockMovementType.GOODS_RECEIPT, qty: p.reorderLevel > 0 ? p.reorderLevel * int(2, 4) : int(12, 36), ref, supplier, cost: p.costPrice });
      }
    }
    const reasons: [StockMovementType, string][] = [[StockMovementType.WASTE, 'Dropped in aisle'], [StockMovementType.DAMAGED, 'Crushed box'], [StockMovementType.EXPIRED, 'Past use-by date'], [StockMovementType.WASTE, 'Spoiled in chiller']];
    for (let i = 0; i < 10; i++) {
      const [type, reason] = pick(reasons);
      const at = new Date(Date.now() - int(1, 6) * day - int(0, 8) * 3600000);
      events.push({ at, product: pick(ps.filter((x) => x.unitType === 'each' && x.stockQuantity > 5)), type, qty: -int(1, 3), ref: `DEMO-WO-${i + 1}`, reason });
    }
    // one second apart, so the history always has a single, unambiguous order
    events.sort((a, b) => a.at.getTime() - b.at.getTime());
    events.forEach((e, i) => { e.at = new Date(e.at.getTime() + i * 1000); });
    const rows: Partial<StockMovement>[] = [];
    for (const e of events) {
      const after = round3((stock.get(e.product.id) ?? 0) + e.qty);
      stock.set(e.product.id, after);
      rows.push({ storeId: store.id, productId: e.product.id, type: e.type, quantity: e.qty, quantityAfter: after, unitCost: e.cost ?? null, reason: e.reason ?? null, reference: e.ref, supplier: e.supplier ?? null, userName: 'Manager', createdAt: e.at });
    }
    // a few products running low or out: shows the reorder list on the Stock overview
    const candidates = ps.filter((p) => p.unitType === 'each' && p.reorderLevel > 0);
    const lows = Array.from(new Set(Array.from({ length: 8 }, () => pick(candidates)))).slice(0, 6);
    lows.forEach((p, i) => {
      const target = i < 2 ? 0 : Math.max(1, Math.floor(p.reorderLevel / 2));
      const before = stock.get(p.id) ?? 0;
      stock.set(p.id, target);
      rows.push({ storeId: store.id, productId: p.id, type: StockMovementType.ADJUSTMENT, quantity: round3(target - before), quantityAfter: target, reason: 'Shelf check: stock run down', reference: `DEMO-LOW-${i + 1}`, userName: 'Manager', createdAt: new Date() });
    });
    await ledger.save(rows.filter((r) => r.quantity !== 0).map((r) => ledger.create(r as any) as unknown as StockMovement));
    for (const p of ps) if (stock.get(p.id) !== start.get(p.id)) await products.update(p.id, { stockQuantity: stock.get(p.id)! });
    console.log(`${store.name}: ${events.length} deliveries/write-offs, ${lows.length} low-stock products`);
  }

  // ---------- pack barcodes ----------
  const packs = ds.getRepository(ProductBarcode);
  const packPlan: { department: string; take: number; qty: number; label: string }[] = [
    { department: 'Drinks', take: 4, qty: 6, label: 'Six pack' },
    { department: 'Alcohol', take: 2, qty: 6, label: 'Case of 6' },
    { department: 'Snacks & Confectionery', take: 2, qty: 12, label: 'Box of 12' },
  ];
  for (const [si, store] of stores.entries()) {
    let n = 0;
    const lines: string[] = [];
    for (const plan of packPlan) {
      const all = await products.find({ where: { storeId: store.id, department: plan.department, isActive: true, unitType: 'each' as any }, order: { name: 'ASC', barcode: 'ASC' } });
      const ps = all.filter((p, i) => all.findIndex((x) => x.name === p.name) === i).slice(0, plan.take);
      for (const p of ps) {
        const barcode = `9900${si + 1}${String(++n).padStart(8, '0')}`;
        if (await packs.count({ where: { storeId: store.id, barcode } })) continue;
        await packs.save(packs.create({ storeId: store.id, productId: p.id, barcode, packQuantity: plan.qty, label: plan.label }));
        lines.push(`${barcode}  ${plan.label} of ${p.name}`);
      }
    }
    console.log(`${store.name}: ${lines.length} pack barcodes\n  ${lines.join('\n  ')}`);
  }

  // ---------- suppliers and purchase orders ----------
  const supRepo = ds.getRepository(Supplier);
  const SUPPLIER_INFO: Record<string, { contact: string; phone: string; lead: number; departments: string[] }> = {
    'Booker Wholesale': { contact: 'Sam Patel', phone: '0113 496 0101', lead: 2, departments: ['Grocery', 'Drinks', 'Alcohol', 'Snacks & Confectionery', 'Household', 'Health & Beauty', 'Tobacco'] },
    Bidfood: { contact: 'Lucy Grant', phone: '0113 496 0202', lead: 3, departments: ['Frozen', 'Dairy & Eggs'] },
    'Fresh Direct': { contact: 'Omar Hussain', phone: '0113 496 0303', lead: 1, departments: ['Fruit & Veg'] },
    Brakes: { contact: 'Kate Moss', phone: '0113 496 0404', lead: 2, departments: ['Meat & Fish'] },
    'Park Cakes Ltd': { contact: 'Ben Hall', phone: '0113 496 0505', lead: 1, departments: ['Bakery'] },
  };
  const madeSuppliers: Supplier[] = [];
  for (const [i, name] of SUPPLIERS.entries()) {
    const info = SUPPLIER_INFO[name];
    madeSuppliers.push(await supRepo.save(supRepo.create({
      tenantId: tenant.id, name, contactName: info.contact, phone: info.phone, leadTimeDays: info.lead,
      email: `orders@${name.toLowerCase().replace(/[^a-z]/g, '')}.test`, accountNumber: `FM-${10400 + i * 17}`, notes: TAG, isActive: true,
    })));
  }
  const poRepo = ds.getRepository(PurchaseOrder);
  const lineRepo = ds.getRepository(PurchaseOrderLine);
  const isoDay = (offset: number) => new Date(Date.now() + offset * day).toISOString().slice(0, 10);
  for (const store of stores) {
    for (const sup of madeSuppliers) {
      const deps = SUPPLIER_INFO[sup.name].departments;
      await products.createQueryBuilder().update().set({ supplierId: sup.id })
        .where('storeId = :sid AND department IN (:...deps)', { sid: store.id, deps }).execute();
    }
    const last = await poRepo.createQueryBuilder('o').select('COALESCE(MAX(o.seq), 0)', 'max').where('o.storeId = :sid', { sid: store.id }).getRawOne();
    let seq = Number(last?.max ?? 0);
    const manager = (await ds.getRepository(User).find({ where: { restaurantId: store.id, role: UserRole.MANAGER } }))[0];
    const plan: { sup: string; status: PurchaseOrderStatus; orderedDaysAgo: number | null; expected: number | null; count: number }[] = [
      { sup: 'Booker Wholesale', status: PurchaseOrderStatus.ORDERED, orderedDaysAgo: 1, expected: 1, count: 6 },
      { sup: 'Bidfood', status: PurchaseOrderStatus.ORDERED, orderedDaysAgo: 5, expected: -2, count: 4 },
      { sup: 'Park Cakes Ltd', status: PurchaseOrderStatus.DRAFT, orderedDaysAgo: null, expected: null, count: 3 },
    ];
    for (const po of plan) {
      const sup = madeSuppliers.find((x) => x.name === po.sup)!;
      const ps = (await products.find({ where: { storeId: store.id, supplierId: sup.id, isActive: true, unitType: 'each' as any }, order: { name: 'ASC' } }))
        .filter((p, i, all) => all.findIndex((x) => x.name === p.name) === i).slice(0, po.count);
      if (!ps.length) continue;
      const lines = ps.map((p, i) => ({ productId: p.id, productName: p.name, barcode: p.barcode, quantity: Math.max(6, Math.ceil(p.reorderLevel * 2)), unitCost: p.costPrice ?? round2(p.price * 0.6), sortOrder: i }));
      seq++;
      const order = await poRepo.save(poRepo.create({
        storeId: store.id, supplierId: sup.id, seq, number: `PO-${String(seq).padStart(6, '0')}`, status: po.status,
        orderedAt: po.orderedDaysAgo === null ? null : new Date(Date.now() - po.orderedDaysAgo * day),
        expectedDate: po.expected === null ? null : isoDay(po.expected),
        totalCost: round2(lines.reduce((a, l) => a + l.quantity * l.unitCost, 0)),
        createdById: manager?.id ?? null, createdByName: manager?.name ?? 'Manager',
        notes: po.status === PurchaseOrderStatus.DRAFT ? 'Weekend bake: check quantities before sending' : null,
      }));
      await lineRepo.save(lines.map((l) => lineRepo.create({ ...l, purchaseOrderId: order.id })));
    }
    console.log(`${store.name}: ${SUPPLIERS.length} suppliers linked to products, ${plan.length} purchase orders`);
  }

  // ---------- attendance ----------
  const entries: TimeEntry[] = [];
  const te = ds.getRepository(TimeEntry);
  for (const s of demoShifts) {
    entries.push(te.create({ storeId: s.storeId, userId: s.userId, userName: s.cashierName, clockedInAt: new Date(s.openedAt.getTime() - int(2, 9) * 60000), clockedOutAt: new Date(s.closedAt!.getTime() + int(3, 15) * 60000), note: TAG }));
  }
  for (const store of stores) {
    const manager = (await ds.getRepository(User).find({ where: { restaurantId: store.id, role: UserRole.MANAGER } }))[0];
    if (!manager) continue;
    for (let d = 7; d >= 1; d--) {
      const inAt = new Date(); inAt.setDate(inAt.getDate() - d); inAt.setHours(8, int(0, 25), 0, 0);
      const outAt = new Date(inAt); outAt.setHours(17, int(0, 40));
      entries.push(te.create({ storeId: store.id, userId: manager.id, userName: manager.name, clockedInAt: inAt, clockedOutAt: outAt, note: TAG }));
    }
  }
  await te.save(entries);
  console.log(`Attendance: ${entries.length} clock entries`);

  await ds.destroy();
}
main().catch((e) => { console.error('Seed failed:', e.message); process.exit(1); });
