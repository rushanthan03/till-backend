import { round2 } from '../sales/sale-calculations';

/** Cash differences above this (either way) need a written reason before the till can close. */
export const VARIANCE_NOTE_THRESHOLD = 2;

/** Cash that should be in the drawer: float + cash taken - cash given back. */
export const expectedCash = (openingFloat: number, cashSales: number, cashRefunds: number): number =>
  round2(openingFloat + cashSales - cashRefunds);

/** Positive = more cash than expected (over); negative = short. */
export const cashVariance = (countedCash: number, expected: number): number => round2(countedCash - expected);

export const varianceNeedsNote = (variance: number, threshold = VARIANCE_NOTE_THRESHOLD): boolean =>
  Math.abs(variance) > threshold;
