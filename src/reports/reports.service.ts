import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { round2 } from '../sales/sale-calculations';
import { ProductReportQueryDto, ReportQueryDto } from './dto/report.dto';

const n = (v: unknown) => round2(Number(v ?? 0));

/**
 * Read-only reports. Definitions match the X/Z reports and the sales summary:
 *  - gross = everything sold (voided sales left out), refunds shown separately, net = gross - refunds
 *  - a refund counts in the period it was made, not the period of the original sale
 */
@Injectable()
export class ReportsService {
  constructor(private readonly dataSource: DataSource) {}

  private period(q: ReportQueryDto) {
    const from = q.from ? new Date(q.from) : new Date(2000, 0, 1);
    const to = q.to ? new Date(q.to) : new Date();
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) throw new BadRequestException('from/to must be valid dates');
    if (from > to) throw new BadRequestException('The start of the period is after its end');
    return { from, to };
  }

  /** VAT by rate: what was taken, what was refunded, and the VAT due on the difference. */
  async vat(storeId: string, q: ReportQueryDto) {
    const { from, to } = this.period(q);
    const sold: any[] = await this.dataSource.query(
      `SELECT si."vatRate" AS rate, SUM(si."lineTotal") AS gross, SUM(si."vatAmount") AS vat
         FROM sale_items si JOIN sales s ON s.id = si."saleId"
        WHERE s."storeId" = $1 AND s.status <> 'voided' AND s."createdAt" BETWEEN $2 AND $3
        GROUP BY si."vatRate"`,
      [storeId, from, to],
    );
    const refunded: any[] = await this.dataSource.query(
      `SELECT si."vatRate" AS rate, SUM(ri."lineTotal") AS gross, SUM(ri."vatAmount") AS vat
         FROM refund_items ri JOIN refunds r ON r.id = ri."refundId" JOIN sale_items si ON si.id = ri."saleItemId"
        WHERE r."storeId" = $1 AND r."createdAt" BETWEEN $2 AND $3
        GROUP BY si."vatRate"`,
      [storeId, from, to],
    );
    const rates = [...new Set([...sold, ...refunded].map((r) => Number(r.rate)))].sort((a, b) => b - a);
    const rows = rates.map((rate) => {
      const s = sold.find((r) => Number(r.rate) === rate);
      const r = refunded.find((x) => Number(x.rate) === rate);
      const grossSales = n(s?.gross);
      const refunds = n(r?.gross);
      const netGross = round2(grossSales - refunds);
      const vat = round2(n(s?.vat) - n(r?.vat));
      return { rate, grossSales, refunds, grossNet: netGross, vat, netExVat: round2(netGross - vat) };
    });
    const sum = (k: 'grossSales' | 'refunds' | 'grossNet' | 'vat' | 'netExVat') => round2(rows.reduce((a, r) => a + r[k], 0));
    return { from, to, rows, totals: { grossSales: sum('grossSales'), refunds: sum('refunds'), grossNet: sum('grossNet'), vat: sum('vat'), netExVat: sum('netExVat') } };
  }

  /** Takings by tender (cash / card). */
  async tender(storeId: string, q: ReportQueryDto) {
    const { from, to } = this.period(q);
    const sold: any[] = await this.dataSource.query(
      `SELECT p.method AS method, SUM(p.amount) AS amount, COUNT(*) AS count
         FROM sale_payments p JOIN sales s ON s.id = p."saleId"
        WHERE s."storeId" = $1 AND s.status <> 'voided' AND s."createdAt" BETWEEN $2 AND $3
        GROUP BY p.method`,
      [storeId, from, to],
    );
    const refunded: any[] = await this.dataSource.query(
      `SELECT rp.method AS method, SUM(rp.amount) AS amount, COUNT(*) AS count
         FROM refund_payments rp JOIN refunds r ON r.id = rp."refundId"
        WHERE r."storeId" = $1 AND r."createdAt" BETWEEN $2 AND $3
        GROUP BY rp.method`,
      [storeId, from, to],
    );
    const rows = ['cash', 'card'].map((method) => {
      const s = sold.find((r) => r.method === method);
      const r = refunded.find((x) => x.method === method);
      const sales = n(s?.amount);
      const refunds = n(r?.amount);
      return { method, payments: Number(s?.count ?? 0), sales, refunds, net: round2(sales - refunds) };
    });
    const sum = (k: 'sales' | 'refunds' | 'net') => round2(rows.reduce((a, r) => a + r[k], 0));
    return { from, to, rows, totals: { sales: sum('sales'), refunds: sum('refunds'), net: sum('net') } };
  }

  /** Sales by department with discounts and share of net sales. */
  async departments(storeId: string, q: ReportQueryDto) {
    const { from, to } = this.period(q);
    const sold: any[] = await this.dataSource.query(
      `SELECT COALESCE(p.department, 'Unknown') AS department,
              SUM(si.quantity) AS quantity, SUM(si."lineTotal") AS gross,
              SUM(COALESCE((si."originalUnitPrice" - si."unitPrice") * si.quantity, 0) + si."promoDiscount" + si."pointsDiscount") AS discounts
         FROM sale_items si JOIN sales s ON s.id = si."saleId" LEFT JOIN products p ON p.id = si."productId"
        WHERE s."storeId" = $1 AND s.status <> 'voided' AND s."createdAt" BETWEEN $2 AND $3
        GROUP BY 1`,
      [storeId, from, to],
    );
    const refunded: any[] = await this.dataSource.query(
      `SELECT COALESCE(p.department, 'Unknown') AS department, SUM(ri.quantity) AS quantity, SUM(ri."lineTotal") AS gross
         FROM refund_items ri JOIN refunds r ON r.id = ri."refundId" JOIN sale_items si ON si.id = ri."saleItemId" LEFT JOIN products p ON p.id = si."productId"
        WHERE r."storeId" = $1 AND r."createdAt" BETWEEN $2 AND $3
        GROUP BY 1`,
      [storeId, from, to],
    );
    const names = [...new Set([...sold, ...refunded].map((r) => r.department as string))];
    const base = names.map((department) => {
      const s = sold.find((r) => r.department === department);
      const r = refunded.find((x) => x.department === department);
      const gross = n(s?.gross);
      const refunds = n(r?.gross);
      return { department, quantity: Math.round((Number(s?.quantity ?? 0) - Number(r?.quantity ?? 0)) * 1000) / 1000, gross, refunds, net: round2(gross - refunds), discounts: n(s?.discounts) };
    });
    const total = round2(base.reduce((a, r) => a + r.net, 0));
    const rows = base.map((r) => ({ ...r, share: total > 0 ? round2((r.net / total) * 100) : 0 })).sort((a, b) => b.net - a.net);
    return {
      from, to, rows,
      totals: { quantity: round2(rows.reduce((a, r) => a + r.quantity, 0)), gross: round2(rows.reduce((a, r) => a + r.gross, 0)), refunds: round2(rows.reduce((a, r) => a + r.refunds, 0)), net: total, discounts: round2(rows.reduce((a, r) => a + r.discounts, 0)) },
    };
  }

  /** Best sellers, with an estimated margin from the product's current cost price. */
  async products(storeId: string, q: ProductReportQueryDto) {
    const { from, to } = this.period(q);
    const rows: any[] = await this.dataSource.query(
      `WITH sold AS (
         SELECT si."productId" AS pid, MAX(si.name) AS name, MAX(si.barcode) AS barcode,
                SUM(si.quantity) AS qty, SUM(si."lineTotal") AS gross, SUM(si."lineTotal" - si."vatAmount") AS net_ex
           FROM sale_items si JOIN sales s ON s.id = si."saleId"
          WHERE s."storeId" = $1 AND s.status <> 'voided' AND s."createdAt" BETWEEN $2 AND $3 AND si."productId" IS NOT NULL
          GROUP BY si."productId"),
       ref AS (
         SELECT ri."productId" AS pid, SUM(ri.quantity) AS qty, SUM(ri."lineTotal") AS gross, SUM(ri."lineTotal" - ri."vatAmount") AS net_ex
           FROM refund_items ri JOIN refunds r ON r.id = ri."refundId"
          WHERE r."storeId" = $1 AND r."createdAt" BETWEEN $2 AND $3 AND ri."productId" IS NOT NULL
          GROUP BY ri."productId")
       SELECT sold.pid AS "productId", sold.name, sold.barcode, p.department, p."costPrice" AS cost,
              sold.qty - COALESCE(ref.qty, 0) AS quantity,
              sold.gross - COALESCE(ref.gross, 0) AS revenue,
              sold.net_ex - COALESCE(ref.net_ex, 0) AS net_ex
         FROM sold LEFT JOIN ref ON ref.pid = sold.pid LEFT JOIN products p ON p.id = sold.pid`,
      [storeId, from, to],
    );
    const mapped = rows.map((r) => {
      const quantity = Math.round(Number(r.quantity) * 1000) / 1000;
      const revenue = n(r.revenue);
      const cost = r.cost === null ? null : Number(r.cost);
      const margin = cost === null ? null : round2(Number(r.net_ex) - cost * quantity);
      return { productId: r.productId, name: r.name, barcode: r.barcode, department: r.department ?? 'Unknown', quantity, revenue, margin, marginPct: margin !== null && Number(r.net_ex) > 0 ? round2((margin / Number(r.net_ex)) * 100) : null };
    });
    const sort = q.sort ?? 'revenue';
    const key = sort === 'quantity' ? 'quantity' : sort === 'margin' ? 'margin' : 'revenue';
    mapped.sort((a, b) => (Number(b[key] ?? -Infinity)) - (Number(a[key] ?? -Infinity)));
    return { from, to, sort, rows: mapped.slice(0, q.limit ?? 20), productsSold: mapped.length };
  }
}
