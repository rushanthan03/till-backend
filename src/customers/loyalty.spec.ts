import { BadRequestException } from '@nestjs/common';
import { allocateDiscount, checkRedemption, pointsFor, pointsValue } from './loyalty';
import { pointsDiscountBack } from '../refunds/refund-calculations';

describe('loyalty points', () => {
  it('values 100 points at £1', () => {
    expect(pointsValue(250)).toBe(2.5);
    expect(pointsFor(2.5)).toBe(250);
  });

  it('checks a redemption against the minimum, the balance and the bill', () => {
    expect(checkRedemption(300, 500, 10)).toBe(3);
    expect(() => checkRedemption(50, 500, 10)).toThrow(BadRequestException);
    expect(() => checkRedemption(600, 500, 10)).toThrow(/only has 500/);
    expect(() => checkRedemption(1200, 5000, 10)).toThrow(/more than the bill/);
    expect(checkRedemption(1000, 5000, 10)).toBe(10); // can cover the whole bill
    expect(() => checkRedemption(150.5, 500, 10)).toThrow(BadRequestException);
  });

  it('shares the discount across lines in proportion, to the penny', () => {
    const shares = allocateDiscount([6, 3, 1], 1);
    expect(shares).toEqual([0.6, 0.3, 0.1]);
    const odd = allocateDiscount([1, 1, 1], 1);
    expect(Math.round(odd.reduce((a, s) => a + s, 0) * 100)).toBe(100);
    expect(odd.every((s) => s >= 0.33 && s <= 0.34)).toBe(true);
  });

  it('never takes a line below zero and can cover the whole bill', () => {
    expect(allocateDiscount([0.05, 9.95], 10)).toEqual([0.05, 9.95]);
    const s = allocateDiscount([0.01, 5], 4.99);
    expect(s[0]).toBeLessThanOrEqual(0.01);
    expect(Math.round((s[0] + s[1]) * 100)).toBe(499);
  });

  it('gives points back pro rata on refunds, with the last unit taking the remainder', () => {
    const item = { id: 'a', quantity: 3, unitPrice: 1, vatRate: 20, lineTotal: 2, vatAmount: 0.33, refundedQuantity: 0, refundedAmount: 0, refundedVat: 0, pointsDiscount: 1, refundedPointsDiscount: 0 };
    expect(pointsDiscountBack(item, 1)).toBe(0.33);
    expect(pointsDiscountBack({ ...item, refundedQuantity: 2, refundedPointsDiscount: 0.66 }, 1)).toBe(0.34);
    expect(pointsDiscountBack({ ...item, pointsDiscount: 0 }, 1)).toBe(0);
  });
});
