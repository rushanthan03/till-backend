import { EntityManager } from 'typeorm';
import { StockMovement, StockMovementType } from '../infrastructure/database/entities/stock-movement.entity';
import { round3 } from '../sales/sale-calculations';

export interface LedgerEntry {
  storeId: string;
  productId: string;
  type: StockMovementType;
  quantity: number;
  quantityAfter: number;
  unitCost?: number | null;
  reason?: string | null;
  reference?: string | null;
  supplier?: string | null;
  userId?: string | null;
  userName?: string | null;
}

/** Writes ledger rows inside the caller's transaction so stock and its history can never disagree. */
export async function recordStockMovements(manager: EntityManager, entries: LedgerEntry[]): Promise<void> {
  const rows = entries
    .filter((e) => e.quantity !== 0)
    .map((e) => manager.create(StockMovement, { ...e, quantity: round3(e.quantity), quantityAfter: round3(e.quantityAfter) }));
  if (rows.length) await manager.save(StockMovement, rows);
}

/** Types that take stock out when entered manually (the quantity is typed as a positive number). */
export const WRITE_OFF_TYPES = [StockMovementType.WASTE, StockMovementType.DAMAGED, StockMovementType.EXPIRED];

/** Turns what the user typed into the signed change to apply. */
export function signedChange(type: StockMovementType, quantity: number): number {
  return WRITE_OFF_TYPES.includes(type) ? -Math.abs(quantity) : quantity;
}
