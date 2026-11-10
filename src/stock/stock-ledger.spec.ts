import { StockMovementType } from '../infrastructure/database/entities/stock-movement.entity';
import { signedChange } from './stock-ledger';

describe('stock ledger', () => {
  it('write-offs always remove stock, however the quantity was typed', () => {
    expect(signedChange(StockMovementType.WASTE, 3)).toBe(-3);
    expect(signedChange(StockMovementType.DAMAGED, 2)).toBe(-2);
    expect(signedChange(StockMovementType.EXPIRED, 1.5)).toBe(-1.5);
  });
  it('adjustments keep the sign they were given', () => {
    expect(signedChange(StockMovementType.ADJUSTMENT, 5)).toBe(5);
    expect(signedChange(StockMovementType.ADJUSTMENT, -4)).toBe(-4);
  });
});
