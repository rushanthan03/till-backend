/**
 * The email version of a till receipt. Pure functions so they can be tested without a mail server.
 * A gift receipt lists what was bought without any prices, totals or payments.
 */

export interface ReceiptStore {
  name: string;
  address?: { lane?: string; city?: string; district?: string; country?: string } | null;
  contactEmail?: string | null;
  contactPhoneNumber?: string | null;
}

export interface ReceiptSale {
  receiptNumber: string;
  createdAt: Date | string;
  cashierName?: string | null;
  customerName?: string | null;
  total: number | string;
  discountTotal?: number | string;
  changeDue?: number | string;
  pointsEarned?: number;
  pointsRedeemed?: number;
  pointsDiscount?: number | string;
  refundedTotal?: number | string;
  items: { name: string; quantity: number | string; unitPrice: number | string; lineTotal: number | string; vatRate: number | string; vatAmount: number | string; promoDiscount?: number | string; promotionName?: string | null; originalUnitPrice?: number | string | null; adjustmentReason?: string | null }[];
  payments: { method: string; amount: number | string; tendered?: number | string | null; reference?: string | null }[];
}

const n = (v: unknown) => Number(v ?? 0);
const money = (v: unknown) => `£${n(v).toFixed(2)}`;
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function storeAddress(store: ReceiptStore): string {
  const a = store.address;
  return a ? [a.lane, a.city, a.district].filter(Boolean).join(', ') : '';
}

function qtyText(q: number, unit: unknown) {
  return Number.isInteger(q) ? `${q} × ${money(unit)}` : `${q} kg @ ${money(unit)}/kg`;
}

function when(d: Date | string) {
  return new Date(d).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });
}

function vatRows(sale: ReceiptSale) {
  const map = new Map<number, { net: number; vat: number; gross: number }>();
  for (const i of sale.items) {
    const rate = n(i.vatRate);
    const row = map.get(rate) ?? { net: 0, vat: 0, gross: 0 };
    row.gross += n(i.lineTotal);
    row.vat += n(i.vatAmount);
    row.net += n(i.lineTotal) - n(i.vatAmount);
    map.set(rate, row);
  }
  return [...map.entries()].sort((a, b) => a[0] - b[0]);
}

export function receiptSubject(sale: ReceiptSale, store: ReceiptStore, gift: boolean) {
  return `${gift ? 'Gift receipt' : 'Your receipt'} from ${store.name} (${sale.receiptNumber})`;
}

export function receiptEmailHtml(sale: ReceiptSale, store: ReceiptStore, gift: boolean): string {
  const addr = storeAddress(store);
  const row = (l: string, r: string, cls = '') => `<tr${cls ? ` class="${cls}"` : ''}><td>${l}</td><td class="r">${r}</td></tr>`;
  const sub = (s: string) => `<tr class="sub"><td colspan="2">${s}</td></tr>`;

  const lines = sale.items.map((i) => {
    const q = n(i.quantity);
    let out = row(esc(gift && q !== 1 ? `${Number.isInteger(q) ? q + ' × ' : q + ' kg '}${i.name}` : i.name), gift ? '' : money(i.lineTotal));
    if (!gift) {
      if (n(i.promoDiscount) > 0) out += sub(`${esc(i.promotionName)}: -${money(i.promoDiscount)}`);
      if (i.originalUnitPrice != null) out += sub(`Was ${money(i.originalUnitPrice)} · ${esc(i.adjustmentReason)}`);
      if (q !== 1) out += sub(qtyText(q, i.unitPrice));
    }
    return out;
  }).join('');

  const totals = gift ? '' : [
    n(sale.discountTotal) > 0 ? row('Discounts', `-${money(sale.discountTotal)}`) : '',
    n(sale.pointsRedeemed) > 0 ? row(`Points used (${n(sale.pointsRedeemed)})`, `-${money(sale.pointsDiscount)}`) : '',
    row('<b>Total</b>', `<b>${money(sale.total)}</b>`, 'total'),
    ...sale.payments.map((p) => row(`${p.method === 'cash' ? 'Cash' : 'Card'}${p.reference ? ` (${esc(p.reference)})` : ''}`, money(p.method === 'cash' && p.tendered ? p.tendered : p.amount))),
    n(sale.changeDue) > 0 ? row('Change', money(sale.changeDue)) : '',
  ].join('');

  const vat = gift ? '' : `
    <table class="vat"><tr><th>VAT</th><th class="r">Net</th><th class="r">VAT</th><th class="r">Gross</th></tr>
    ${vatRows(sale).map(([rate, v]) => `<tr><td>${rate}%</td><td class="r">${money(v.net)}</td><td class="r">${money(v.vat)}</td><td class="r">${money(v.gross)}</td></tr>`).join('')}
    </table>`;

  const customer = !gift && sale.customerName
    ? `<p class="muted">Customer: ${esc(sale.customerName)}${n(sale.pointsEarned) > 0 ? ` · earned ${n(sale.pointsEarned)} points` : ''}</p>` : '';
  const contact = [store.contactPhoneNumber, store.contactEmail].filter(Boolean).map(esc).join(' · ');

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(receiptSubject(sale, store, gift))}</title>
<style>
  body { margin: 0; padding: 24px 12px; background: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; color: #111827; }
  .card { max-width: 420px; margin: 0 auto; background: #fff; border-radius: 8px; padding: 24px; }
  h1 { margin: 0; font-size: 20px; text-align: center; }
  .c { text-align: center; } .muted { color: #6b7280; font-size: 13px; } .r { text-align: right; white-space: nowrap; }
  .gift { margin: 12px 0 0; text-align: center; font-weight: 700; letter-spacing: 1px; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; } td, th { padding: 3px 0; vertical-align: top; }
  .sub td { color: #6b7280; font-size: 12px; padding: 0 0 4px 10px; }
  .total td { font-size: 17px; padding-top: 8px; }
  .vat { font-size: 12px; color: #4b5563; } .vat th { text-align: left; font-weight: 600; }
  hr { border: 0; border-top: 1px dashed #d1d5db; margin: 14px 0; }
</style></head>
<body><div class="card">
  <h1>${esc(store.name)}</h1>
  ${addr ? `<p class="c muted" style="margin:4px 0 0">${esc(addr)}</p>` : ''}
  ${gift ? '<p class="gift">GIFT RECEIPT</p>' : ''}
  <hr>
  <table>${row('Receipt', esc(sale.receiptNumber))}${row('Date', when(sale.createdAt))}${sale.cashierName ? row('Served by', esc(sale.cashierName)) : ''}</table>
  <hr>
  <table>${lines}</table>
  ${gift ? '' : `<hr><table>${totals}</table><hr>${vat}`}
  ${customer}
  <hr>
  <p class="c">${gift ? 'Bring this receipt with the item if you need to exchange or return it.' : 'Thank you for shopping with us.'}</p>
  ${contact ? `<p class="c muted">${contact}</p>` : ''}
</div></body></html>`;
}

/** Plain-text part, for mail apps that do not show HTML. */
export function receiptEmailText(sale: ReceiptSale, store: ReceiptStore, gift: boolean): string {
  const out = [store.name, storeAddress(store), gift ? 'GIFT RECEIPT' : '', '', `Receipt ${sale.receiptNumber}`, when(sale.createdAt), ''];
  for (const i of sale.items) {
    const q = n(i.quantity);
    out.push(gift ? `${q !== 1 ? `${q} ${Number.isInteger(q) ? '×' : 'kg'} ` : ''}${i.name}` : `${i.name}  ${money(i.lineTotal)}${q !== 1 ? ` (${qtyText(q, i.unitPrice)})` : ''}`);
  }
  if (!gift) {
    out.push('');
    if (n(sale.discountTotal) > 0) out.push(`Discounts  -${money(sale.discountTotal)}`);
    if (n(sale.pointsRedeemed) > 0) out.push(`Points used (${n(sale.pointsRedeemed)})  -${money(sale.pointsDiscount)}`);
    out.push(`TOTAL  ${money(sale.total)}`);
    for (const p of sale.payments) out.push(`${p.method === 'cash' ? 'Cash' : 'Card'}  ${money(p.method === 'cash' && p.tendered ? p.tendered : p.amount)}`);
    if (n(sale.changeDue) > 0) out.push(`Change  ${money(sale.changeDue)}`);
  }
  out.push('', gift ? 'Bring this receipt with the item if you need to exchange or return it.' : 'Thank you for shopping with us.');
  return out.filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n');
}

/** "jane.doe@example.com" -> "ja***@example.com", so the audit log does not keep full addresses. */
export function maskEmail(email: string): string {
  const [user, domain] = email.split('@');
  if (!domain) return '***';
  return `${user.slice(0, 2)}***@${domain}`;
}
