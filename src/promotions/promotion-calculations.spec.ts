import { bestPromotion, ruleDiscount, PromoRule } from './promotion-calculations';

const rule = (o: Partial<PromoRule>): PromoRule => ({
  id: 'r', name: 'x', type: 'percent_off', scope: 'product', productId: 'p1', department: null, percentOff: null, buyQty: null, bundlePrice: null, ...o,
});

describe('promotion calculations', () => {
  it('percent off applies to the whole line', () => {
    expect(ruleDiscount(rule({ percentOff: 25 }), 2, 3)).toBe(1.5);
  });
  it('multibuy discounts whole groups only', () => {
    const r = rule({ type: 'multibuy', buyQty: 3, bundlePrice: 5 });
    expect(ruleDiscount(r, 2, 3)).toBe(1); // 6 -> 5
    expect(ruleDiscount(r, 2, 5)).toBe(1); // one group, two left at full price
    expect(ruleDiscount(r, 2, 7)).toBe(2); // two groups
    expect(ruleDiscount(r, 2, 2)).toBe(0);
  });
  it('a multibuy that costs more than shelf price gives no discount', () => {
    expect(ruleDiscount(rule({ type: 'multibuy', buyQty: 2, bundlePrice: 9 }), 2, 2)).toBe(0);
  });
  it('does not apply multibuy to weighed quantities', () => {
    expect(ruleDiscount(rule({ type: 'multibuy', buyQty: 2, bundlePrice: 1 }), 2, 2.5)).toBe(0);
  });
  it('picks the single best offer and respects scope', () => {
    const rules = [rule({ id: 'a', percentOff: 10 }), rule({ id: 'b', scope: 'department', productId: null, department: 'Dairy', percentOff: 20 })];
    expect(bestPromotion(rules, { id: 'p1', department: 'Dairy' }, 2, 1)?.rule.id).toBe('b');
    expect(bestPromotion(rules, { id: 'p1', department: 'Bakery' }, 2, 1)?.rule.id).toBe('a');
    expect(bestPromotion(rules, { id: 'p9', department: 'Bakery' }, 2, 1)).toBeNull();
  });
  it('buy X get Y free gives Y free in every full group', () => {
    const r = rule({ type: 'buy_get_free', buyQty: 2, freeQty: 1 });
    expect(ruleDiscount(r, 1.5, 2)).toBe(0); // not a full group yet
    expect(ruleDiscount(r, 1.5, 3)).toBe(1.5); // 3 for the price of 2
    expect(ruleDiscount(r, 1.5, 5)).toBe(1.5);
    expect(ruleDiscount(r, 1.5, 6)).toBe(3);
    expect(ruleDiscount(rule({ type: 'buy_get_free', buyQty: 1, freeQty: 1 }), 0.99, 4)).toBe(1.98); // BOGOF
  });
  it('does not apply buy-get-free to weighed quantities or incomplete rules', () => {
    expect(ruleDiscount(rule({ type: 'buy_get_free', buyQty: 1, freeQty: 1 }), 2, 2.5)).toBe(0);
    expect(ruleDiscount(rule({ type: 'buy_get_free', buyQty: 2, freeQty: null }), 2, 3)).toBe(0);
  });
});
