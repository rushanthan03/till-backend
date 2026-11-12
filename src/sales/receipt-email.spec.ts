import { maskEmail, receiptEmailHtml, receiptEmailText, receiptSubject } from './receipt-email';

const store = { name: 'Fresh Market <High St>', address: { lane: '1 High Street', city: 'Leeds' }, contactEmail: 'hs@fresh.test' };
const sale = {
  receiptNumber: 'R-000123',
  createdAt: '2026-11-12T10:30:00Z',
  cashierName: 'Sam',
  customerName: 'Jo Bloggs',
  total: '7.48',
  discountTotal: '0.50',
  changeDue: '2.52',
  pointsEarned: 7,
  items: [
    { name: 'Milk 2L', quantity: 2, unitPrice: '1.45', lineTotal: '2.90', vatRate: 0, vatAmount: 0 },
    { name: 'Bananas', quantity: 0.85, unitPrice: '1.20', lineTotal: '1.02', vatRate: 0, vatAmount: 0 },
    { name: 'Wine', quantity: 1, unitPrice: '4.06', lineTotal: '3.56', vatRate: 20, vatAmount: '0.59', promoDiscount: '0.50', promotionName: 'Wine deal' },
  ],
  payments: [{ method: 'cash', amount: '7.48', tendered: '10.00' }],
};

describe('receipt email', () => {
  it('shows prices, totals, payments and VAT on a normal receipt', () => {
    const html = receiptEmailHtml(sale, store, false);
    expect(html).toContain('£7.48');
    expect(html).toContain('Wine deal: -£0.50');
    expect(html).toContain('2 × £1.45');
    expect(html).toContain('0.85 kg @ £1.20/kg');
    expect(html).toContain('£10.00');
    expect(html).toContain('Change');
    expect(html).toContain('20%');
    expect(html).toContain('earned 7 points');
    expect(html).not.toContain('GIFT RECEIPT');
  });

  it('leaves every price and payment off a gift receipt', () => {
    const html = receiptEmailHtml(sale, store, true);
    expect(html).toContain('GIFT RECEIPT');
    expect(html).toContain('2 × Milk 2L');
    expect(html).toContain('R-000123');
    expect(html).not.toMatch(/£/);
    expect(html).not.toContain('Jo Bloggs');
    expect(receiptEmailText(sale, store, true)).not.toMatch(/£/);
  });

  it('escapes store and product names', () => {
    const html = receiptEmailHtml({ ...sale, items: [{ ...sale.items[0], name: '<script>x</script>' }] }, store, false);
    expect(html).toContain('Fresh Market &lt;High St&gt;');
    expect(html).not.toContain('<script>x');
  });

  it('builds the subject and plain text', () => {
    expect(receiptSubject(sale, store, true)).toBe('Gift receipt from Fresh Market <High St> (R-000123)');
    const text = receiptEmailText(sale, store, false);
    expect(text).toContain('TOTAL  £7.48');
    expect(text).toContain('Milk 2L  £2.90 (2 × £1.45)');
  });

  it('masks email addresses for the audit log', () => {
    expect(maskEmail('jane.doe@example.com')).toBe('ja***@example.com');
    expect(maskEmail('nope')).toBe('***');
  });
});
