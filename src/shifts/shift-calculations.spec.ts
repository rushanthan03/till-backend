import { cashVariance, expectedCash, varianceNeedsNote } from './shift-calculations';

describe('shift calculations', () => {
  it('expected cash = float + cash sales - cash refunds', () => {
    expect(expectedCash(100, 250.4, 12.15)).toBe(338.25);
  });
  it('expected cash includes paid in, paid out and safe drops', () => {
    expect(expectedCash(100, 250.4, 12.15, { paidIn: 20, paidOut: 5.5, safeDrops: 150 })).toBe(202.75);
  });
  it('variance is counted minus expected (short is negative)', () => {
    expect(cashVariance(335.25, 338.25)).toBe(-3);
    expect(cashVariance(340, 338.25)).toBe(1.75);
  });
  it('a note is needed only when the difference passes the threshold', () => {
    expect(varianceNeedsNote(2)).toBe(false);
    expect(varianceNeedsNote(-2.01)).toBe(true);
    expect(varianceNeedsNote(0)).toBe(false);
  });
});
