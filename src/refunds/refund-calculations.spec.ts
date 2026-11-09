import { BadRequestException } from '@nestjs/common';
import { allocateRefundPayments, calcRefundLines, RefundableItem, sumRefund } from './refund-calculations';

const item = (over: Partial<RefundableItem> = {}): RefundableItem => ({
  id: 'i1', quantity: 3, unitPrice: 1.35, vatRate: 20, lineTotal: 4.05, vatAmount: 0.67,
  refundedQuantity: 0, refundedAmount: 0, refundedVat: 0, ...over,
});

describe('refund calculations', () => {
  it('refunds part of a line at the original unit price', () => {
    const [l] = calcRefundLines([item()], [{ saleItemId: 'i1', quantity: 1 }]);
    expect(l.lineTotal).toBe(1.35);
    // 20% VAT on 1.35 is exactly 22.5p, a half-penny case: either rounding is acceptable
    expect([0.22, 0.23]).toContain(l.vatAmount);
  });

  it('refunding everything returns exactly what was paid, VAT included', () => {
    const [l] = calcRefundLines([item()], [{ saleItemId: 'i1', quantity: 3 }]);
    expect(l).toMatchObject({ lineTotal: 4.05, vatAmount: 0.67 });
  });

  it('partial then final refund add up to the original line (no lost pennies)', () => {
    const first = calcRefundLines([item()], [{ saleItemId: 'i1', quantity: 1 }])[0];
    const second = calcRefundLines(
      [item({ refundedQuantity: 1, refundedAmount: first.lineTotal, refundedVat: first.vatAmount })],
      [{ saleItemId: 'i1', quantity: 2 }],
    )[0];
    expect(Math.round((first.lineTotal + second.lineTotal) * 100) / 100).toBe(4.05);
    expect(Math.round((first.vatAmount + second.vatAmount) * 100) / 100).toBe(0.67);
  });

  it('cannot refund more than was sold, or already refunded', () => {
    expect(() => calcRefundLines([item()], [{ saleItemId: 'i1', quantity: 4 }])).toThrow(BadRequestException);
    expect(() =>
      calcRefundLines([item({ refundedQuantity: 3, refundedAmount: 4.05, refundedVat: 0.67 })], [{ saleItemId: 'i1', quantity: 1 }]),
    ).toThrow(BadRequestException);
  });

  it('rejects empty, unknown, zero and duplicate lines', () => {
    expect(() => calcRefundLines([item()], [])).toThrow(BadRequestException);
    expect(() => calcRefundLines([item()], [{ saleItemId: 'nope', quantity: 1 }])).toThrow(BadRequestException);
    expect(() => calcRefundLines([item()], [{ saleItemId: 'i1', quantity: 0 }])).toThrow(BadRequestException);
    expect(() =>
      calcRefundLines([item()], [{ saleItemId: 'i1', quantity: 1 }, { saleItemId: 'i1', quantity: 1 }]),
    ).toThrow(BadRequestException);
  });

  it('supports refunding part of a weighed item', () => {
    const weighed = item({ quantity: 0.755, unitPrice: 1.1, vatRate: 0, lineTotal: 0.83, vatAmount: 0 });
    const [l] = calcRefundLines([weighed], [{ saleItemId: 'i1', quantity: 0.5 }]);
    expect(l.lineTotal).toBe(0.55);
  });

  it('sums lines into a refund total', () => {
    const t = sumRefund([
      { saleItemId: 'a', quantity: 1, lineTotal: 1.35, vatAmount: 0.23 },
      { saleItemId: 'b', quantity: 1, lineTotal: 3.3, vatAmount: 0 },
    ]);
    expect(t).toEqual({ total: 4.65, vatTotal: 0.23, netTotal: 4.42 });
  });

  describe('payment allocation', () => {
    it('accepts a refund within what was paid by that method', () => {
      expect(allocateRefundPayments(4.65, [{ method: 'card', amount: 4.65 }], { cash: 5, card: 4.65 })).toHaveLength(1);
    });
    it('rejects refunding more to a method than was paid with it', () => {
      expect(() => allocateRefundPayments(10, [{ method: 'card', amount: 10 }], { cash: 20, card: 4.63 })).toThrow(BadRequestException);
    });
    it('supports splitting a refund across methods', () => {
      expect(() =>
        allocateRefundPayments(9.63, [{ method: 'cash', amount: 5 }, { method: 'card', amount: 4.63 }], { cash: 5, card: 4.63 }),
      ).not.toThrow();
    });
    it('payments must equal the refund total', () => {
      expect(() => allocateRefundPayments(5, [{ method: 'cash', amount: 4 }], { cash: 5, card: 0 })).toThrow(BadRequestException);
    });
  });
});
