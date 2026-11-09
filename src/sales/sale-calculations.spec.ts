import { BadRequestException } from '@nestjs/common';
import { applyPayments, calcLine, formatReceiptNumber, sumLines } from './sale-calculations';

describe('sale calculations', () => {
  it('extracts 20% VAT from a VAT-inclusive price', () => {
    const l = calcLine(1.2, 1, 20);
    expect(l).toEqual({ lineTotal: 1.2, netAmount: 1, vatAmount: 0.2 });
  });

  it('zero-rated items have no VAT', () => {
    expect(calcLine(1.65, 2, 0)).toEqual({ lineTotal: 3.3, netAmount: 3.3, vatAmount: 0 });
  });

  it('prices weighed items by quantity in kg', () => {
    expect(calcLine(2.4, 0.755, 0).lineTotal).toBe(1.81);
  });

  it('totals add up: net + VAT = total, across mixed VAT rates', () => {
    const lines = [calcLine(1.35, 3, 20), calcLine(1.65, 2, 0), calcLine(13.5, 1, 20)];
    const t = sumLines(lines);
    expect(Math.round((t.netTotal + t.vatTotal) * 100) / 100).toBe(t.total);
    expect(t.total).toBe(20.85);
    expect(t.vatTotal).toBe(2.92);
  });

  it('calculates change for cash', () => {
    const r = applyPayments(7.35, [{ method: 'cash', amount: 7.35, tendered: 10 }]);
    expect(r.changeDue).toBe(2.65);
    expect(r.applied[0].tendered).toBe(10);
  });

  it('supports split cash and card payments', () => {
    const r = applyPayments(20, [
      { method: 'cash', amount: 5, tendered: 5 },
      { method: 'card', amount: 15, reference: 'AUTH123' },
    ]);
    expect(r.changeDue).toBe(0);
    expect(r.applied[1].reference).toBe('AUTH123');
  });

  it('rejects underpayment', () => {
    expect(() => applyPayments(10, [{ method: 'cash', amount: 9.99 }])).toThrow(BadRequestException);
  });

  it('rejects applied amounts above the total (cash overpayment must use tendered)', () => {
    expect(() => applyPayments(10, [{ method: 'cash', amount: 12 }])).toThrow(BadRequestException);
  });

  it('rejects cash tendered below the cash amount', () => {
    expect(() => applyPayments(10, [{ method: 'cash', amount: 10, tendered: 5 }])).toThrow(BadRequestException);
  });

  it('formats receipt numbers', () => {
    expect(formatReceiptNumber(42)).toBe('R-000042');
  });
});
