import { PurchaseOrderStatus } from '../infrastructure/database/entities/purchase-order.entity';
import { round2, round3 } from '../sales/sale-calculations';

export const formatPoNumber = (seq: number) => `PO-${String(seq).padStart(6, '0')}`;

/**
 * How much to order: enough to get back to twice the reorder level, less what is already on order.
 * Products counted in whole units round up to a whole number. 0 = nothing to order.
 */
export function suggestedQuantity(stock: number, reorderLevel: number, onOrder: number, wholeUnits: boolean): number {
  if (reorderLevel <= 0 || stock > reorderLevel) return 0;
  const need = reorderLevel * 2 - Math.max(stock, 0) - onOrder;
  if (need <= 0) return 0;
  return wholeUnits ? Math.ceil(need - 1e-9) : round3(need);
}

/** Status after a delivery: received once every line has arrived in full, otherwise partial. */
export function statusAfterReceipt(lines: { quantity: number; receivedQuantity: number }[]): PurchaseOrderStatus {
  return lines.every((l) => l.receivedQuantity >= l.quantity) ? PurchaseOrderStatus.RECEIVED : PurchaseOrderStatus.PARTIAL;
}

export const orderTotal = (lines: { quantity: number; unitCost: number }[]) =>
  round2(lines.reduce((a, l) => a + l.quantity * l.unitCost, 0));

/** Adds a number of days to a YYYY-MM-DD date (or today). */
export function addDays(days: number, from = new Date()): string {
  const d = new Date(Date.UTC(from.getFullYear(), from.getMonth(), from.getDate() + days));
  return d.toISOString().slice(0, 10);
}
