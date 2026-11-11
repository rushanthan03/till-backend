import { PurchaseOrderStatus } from '../infrastructure/database/entities/purchase-order.entity';
import { addDays, formatPoNumber, orderTotal, statusAfterReceipt, suggestedQuantity } from './purchasing-calculations';

describe('purchasing calculations', () => {
  it('numbers orders PO-000001', () => {
    expect(formatPoNumber(1)).toBe('PO-000001');
    expect(formatPoNumber(1234567)).toBe('PO-1234567');
  });

  it('suggests topping up to twice the reorder level, less what is on order', () => {
    expect(suggestedQuantity(2, 10, 0, true)).toBe(18);
    expect(suggestedQuantity(2, 10, 15, true)).toBe(3);
    expect(suggestedQuantity(2, 10, 18, true)).toBe(0);
    expect(suggestedQuantity(-3, 10, 0, true)).toBe(20); // negative stock counts as none
    expect(suggestedQuantity(11, 10, 0, true)).toBe(0); // above the reorder level
    expect(suggestedQuantity(0, 0, 0, true)).toBe(0); // no reorder level set
  });

  it('rounds up for whole units and keeps decimals for weighed goods', () => {
    expect(suggestedQuantity(1.4, 2.5, 0, true)).toBe(4);
    expect(suggestedQuantity(1.4, 2.5, 0, false)).toBe(3.6);
  });

  it('is received only when every line has fully arrived', () => {
    expect(statusAfterReceipt([{ quantity: 10, receivedQuantity: 10 }, { quantity: 5, receivedQuantity: 6 }])).toBe(PurchaseOrderStatus.RECEIVED);
    expect(statusAfterReceipt([{ quantity: 10, receivedQuantity: 10 }, { quantity: 5, receivedQuantity: 4 }])).toBe(PurchaseOrderStatus.PARTIAL);
  });

  it('totals the order cost', () => {
    expect(orderTotal([{ quantity: 3, unitCost: 0.335 }, { quantity: 24, unitCost: 1.1 }])).toBe(27.41);
  });

  it('works out the expected date', () => {
    expect(addDays(3, new Date(2026, 11, 30))).toBe('2027-01-02');
  });
});
