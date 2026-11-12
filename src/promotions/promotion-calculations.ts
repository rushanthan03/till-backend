import { round2 } from '../sales/sale-calculations';

export interface PromoRule {
  id: string;
  name: string;
  type: 'percent_off' | 'multibuy' | 'buy_get_free';
  scope: 'product' | 'department';
  productId: string | null;
  department: string | null;
  percentOff: number | null;
  buyQty: number | null;
  freeQty?: number | null;
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
  if (r.type === 'buy_get_free') {
    // Buy X get Y free: every full group of X + Y has Y free. Counted items only.
    const buy = r.buyQty ?? 0;
    const free = r.freeQty ?? 0;
    if (buy < 1 || free < 1 || !Number.isInteger(quantity)) return 0;
    const groups = Math.floor(quantity / (buy + free));
    return round2(groups * free * unitPrice);
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

/** The deal in words, e.g. "20% off", "3 for £5.00", "Buy 2 get 1 free". */
export function describeDeal(r: Pick<PromoRule, 'type' | 'percentOff' | 'buyQty' | 'bundlePrice' | 'freeQty'>): string {
  if (r.type === 'percent_off') return `${Number(r.percentOff)}% off`;
  if (r.type === 'multibuy') return `${r.buyQty} for £${Number(r.bundlePrice).toFixed(2)}`;
  return `Buy ${r.buyQty} get ${r.freeQty} free`;
}

type OfferLike = Pick<PromoRule, 'name' | 'type' | 'scope' | 'productId' | 'department' | 'percentOff' | 'buyQty' | 'bundlePrice' | 'freeQty'> & { startsAt: Date | null; endsAt: Date | null; isActive: boolean };

/** What changed between two versions of an offer, in words for the audit log. */
export function offerChanges(before: OfferLike, after: OfferLike): string[] {
  const day = (d: Date | null) => (d ? new Date(d).toLocaleDateString('en-GB', { timeZone: 'Europe/London' }) : 'none');
  const out: string[] = [];
  if (before.name !== after.name) out.push(`name "${before.name}" → "${after.name}"`);
  if (describeDeal(before) !== describeDeal(after)) out.push(`deal ${describeDeal(before)} → ${describeDeal(after)}`);
  if (before.scope !== after.scope || before.productId !== after.productId || before.department !== after.department) {
    out.push(after.scope === 'department' ? `now applies to department ${after.department}` : 'now applies to a different product');
  }
  if (day(before.startsAt) !== day(after.startsAt)) out.push(`start ${day(before.startsAt)} → ${day(after.startsAt)}`);
  if (day(before.endsAt) !== day(after.endsAt)) out.push(`end ${day(before.endsAt)} → ${day(after.endsAt)}`);
  if (before.isActive !== after.isActive) out.push(after.isActive ? 'switched on' : 'switched off');
  return out;
}
