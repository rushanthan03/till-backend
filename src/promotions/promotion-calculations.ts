import { round2 } from '../sales/sale-calculations';

export interface PromoRule {
  id: string;
  name: string;
  type: 'percent_off' | 'multibuy';
  scope: 'product' | 'department';
  productId: string | null;
  department: string | null;
  percentOff: number | null;
  buyQty: number | null;
  bundlePrice: number | null;
}

export interface PromoTarget {
  id: string;
  department: string;
}

export const appliesTo = (r: PromoRule, p: PromoTarget): boolean =>
  r.scope === 'product' ? r.productId === p.id : r.department !== null && r.department === p.department;

/** Money taken off a line (VAT included) by one rule; 0 when the rule does not bite. */
export function ruleDiscount(r: PromoRule, unitPrice: number, quantity: number): number {
  if (r.type === 'percent_off') {
    return round2((unitPrice * quantity * (r.percentOff ?? 0)) / 100);
  }
  // multibuy: whole groups only, and only for counted (each) quantities
  const n = r.buyQty ?? 0;
  if (n < 2 || r.bundlePrice === null || !Number.isInteger(quantity)) return 0;
  const groups = Math.floor(quantity / n);
  return Math.max(0, round2(groups * (unitPrice * n - r.bundlePrice)));
}

/** The best single offer for a line (offers never stack). */
export function bestPromotion(rules: PromoRule[], product: PromoTarget, unitPrice: number, quantity: number): { rule: PromoRule; discount: number } | null {
  let best: { rule: PromoRule; discount: number } | null = null;
  for (const rule of rules) {
    if (!appliesTo(rule, product)) continue;
    const discount = ruleDiscount(rule, unitPrice, quantity);
    if (discount > 0 && (!best || discount > best.discount)) best = { rule, discount };
  }
  return best;
}
