import { BadRequestException } from '@nestjs/common';
import { round2 } from '../sales/sale-calculations';

/**
 * Loyalty rules in one place.
 *  - Earn: 1 point per whole £1 actually paid (points spent don't earn points).
 *  - Spend: 100 points = £1 off, at least MIN_REDEEM_POINTS at a time.
 * Points are the shop's own scheme, so for VAT they are a discount: they reduce the
 * price of the goods (and the VAT on them), not a way of paying.
 */
export const POINTS_PER_POUND = 100;
export const MIN_REDEEM_POINTS = 100;

export const pointsValue = (points: number): number => round2(points / POINTS_PER_POUND);
export const pointsFor = (value: number): number => Math.round(value * POINTS_PER_POUND);

/** Checks a redemption against the customer's balance and the bill; returns its value in pounds. */
export function checkRedemption(points: number, balance: number, total: number): number {
  if (!Number.isInteger(points) || points <= 0) throw new BadRequestException('Points to spend must be a whole number');
  if (points < MIN_REDEEM_POINTS) throw new BadRequestException(`At least ${MIN_REDEEM_POINTS} points must be spent at a time`);
  if (points > balance) throw new BadRequestException(`The customer only has ${balance} points`);
  const value = pointsValue(points);
  if (value > total) throw new BadRequestException(`${points} points (£${value.toFixed(2)}) is more than the bill of £${total.toFixed(2)}`);
  return value;
}

/**
 * Shares a points discount across the lines in proportion to their totals, to the penny.
 * The pennies left over by rounding go to the biggest line; no line goes below zero.
 */
export function allocateDiscount(lineTotals: number[], value: number): number[] {
  const total = round2(lineTotals.reduce((a, t) => a + t, 0));
  if (value <= 0 || total <= 0) return lineTotals.map(() => 0);
  if (value >= total) return lineTotals.map((t) => round2(t));
  const shares = lineTotals.map((t) => Math.min(t, round2((value * t) / total)));
  let left = round2(value - shares.reduce((a, s) => a + s, 0));
  // Hand out (or take back) the odd pennies, biggest lines first.
  const order = lineTotals.map((t, i) => i).sort((a, b) => lineTotals[b] - lineTotals[a]);
  for (let guard = 0; Math.abs(left) >= 0.005 && guard < 10000; guard++) {
    const step = left > 0 ? 0.01 : -0.01;
    const i = order[guard % order.length];
    const next = round2(shares[i] + step);
    if (next < 0 || next > lineTotals[i]) continue;
    shares[i] = next;
    left = round2(left - step);
  }
  return shares;
}
