import { round2 } from '../sales/sale-calculations';

/** Cash differences above this (either way) need a written reason before the till can close. */
export const VARIANCE_NOTE_THRESHOLD = 2;

/** Cash that should be in the drawer: float + cash taken - cash refunded + paid in - paid out - safe drops. */
export const expectedCash = (
  openingFloat: number,
  cashSales: number,
  cashRefunds: number,
  movements: { paidIn?: number; paidOut?: number; safeDrops?: number } = {},
): number =>
  round2(openingFloat + cashSales - cashRefunds + (movements.paidIn ?? 0) - (movements.paidOut ?? 0) - (movements.safeDrops ?? 0));

/** Positive = more cash than expected (over); negative = short. */
export const cashVariance = (countedCash: number, expected: number): number => round2(countedCash - expected);

export const varianceNeedsNote = (variance: number, threshold = VARIANCE_NOTE_THRESHOLD): boolean =>
  Math.abs(variance) > threshold;
