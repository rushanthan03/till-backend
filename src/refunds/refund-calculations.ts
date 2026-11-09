import { BadRequestException } from '@nestjs/common';
import { calcLine, round2, round3 } from '../sales/sale-calculations';

export interface RefundableItem {
  id: string;
  name?: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  lineTotal: number;
  vatAmount: number;
  refundedQuantity: number;
  refundedAmount: number;
  refundedVat: number;
}

export interface RefundLineResult {
  saleItemId: string;
  quantity: number;
  lineTotal: number;
  vatAmount: number;
}

/**
 * Works out what each requested refund line is worth. Partial quantities use the original
 * unit price; the final remaining quantity takes whatever is left of the original line so the
 * pennies always add back up to exactly what the customer paid.
 */
export function calcRefundLines(items: RefundableItem[], requested: { saleItemId: string; quantity: number }[]): RefundLineResult[] {
  if (!requested.length) throw new BadRequestException('Select at least one item to refund');
  const seen = new Set<string>();

  return requested.map((r) => {
    if (seen.has(r.saleItemId)) throw new BadRequestException('Each item can only appear once in a refund');
    seen.add(r.saleItemId);

    const item = items.find((i) => i.id === r.saleItemId);
    if (!item) throw new BadRequestException('Refund item does not belong to this sale');
    const quantity = round3(r.quantity);
    if (!(quantity > 0)) throw new BadRequestException('Refund quantity must be greater than zero');

    const remaining = round3(item.quantity - item.refundedQuantity);
    if (quantity > remaining) {
      throw new BadRequestException(`Only ${remaining} of "${item.name ?? item.id}" can still be refunded`);
    }

    if (quantity === remaining) {
      // Last of this line: use the exact remainder.
      return {
        saleItemId: item.id,
        quantity,
        lineTotal: round2(item.lineTotal - item.refundedAmount),
        vatAmount: round2(item.vatAmount - item.refundedVat),
      };
    }
    const a = calcLine(item.unitPrice, quantity, item.vatRate);
    return { saleItemId: item.id, quantity, lineTotal: a.lineTotal, vatAmount: a.vatAmount };
  });
}

export const sumRefund = (lines: RefundLineResult[]) => {
  const total = round2(lines.reduce((a, l) => a + l.lineTotal, 0));
  const vatTotal = round2(lines.reduce((a, l) => a + l.vatAmount, 0));
  return { total, vatTotal, netTotal: round2(total - vatTotal) };
};

export interface RefundPaymentInput {
  method: 'cash' | 'card';
  amount: number;
  reference?: string;
}

/**
 * Money goes back the way it came: each method can only refund up to what was paid by that
 * method on the sale, less anything already refunded that way.
 */
export function allocateRefundPayments(
  total: number,
  payments: RefundPaymentInput[],
  capacity: { cash: number; card: number },
): RefundPaymentInput[] {
  if (!payments.length) throw new BadRequestException('Choose how to refund the customer');
  const sum = round2(payments.reduce((a, p) => a + p.amount, 0));
  if (sum !== total) {
    throw new BadRequestException(`Refund payments (${sum.toFixed(2)}) must equal the refund total (${total.toFixed(2)})`);
  }
  const byMethod = { cash: 0, card: 0 };
  for (const p of payments) {
    if (!(p.amount > 0)) throw new BadRequestException('Refund payment amounts must be greater than zero');
    byMethod[p.method] = round2(byMethod[p.method] + p.amount);
  }
  (['cash', 'card'] as const).forEach((m) => {
    if (byMethod[m] > round2(capacity[m])) {
      throw new BadRequestException(
        `Cannot refund ${byMethod[m].toFixed(2)} to ${m}: only ${Math.max(capacity[m], 0).toFixed(2)} was paid that way and not yet refunded`,
      );
    }
  });
  return payments;
}

export const formatRefundNumber = (seq: number): string => `RF-${String(seq).padStart(6, '0')}`;
