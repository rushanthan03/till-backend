import { BadRequestException } from '@nestjs/common';

export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;
export const round3 = (n: number): number => Math.round((n + Number.EPSILON) * 1000) / 1000;

export interface LineAmounts {
  lineTotal: number;
  netAmount: number;
  vatAmount: number;
}

/** Shelf prices include VAT, so VAT is extracted from the gross line total. */
export function calcLine(unitPrice: number, quantity: number, vatRate: number): LineAmounts {
  const lineTotal = round2(unitPrice * quantity);
  const netAmount = round2(lineTotal / (1 + vatRate / 100));
  return { lineTotal, netAmount, vatAmount: round2(lineTotal - netAmount) };
}

/** Like calcLine, with a promotion discount taken off the gross line total (VAT is re-extracted from what is left). */
export function calcLineWithDiscount(unitPrice: number, quantity: number, vatRate: number, discount: number): LineAmounts {
  const lineTotal = round2(round2(unitPrice * quantity) - discount);
  const netAmount = round2(lineTotal / (1 + vatRate / 100));
  return { lineTotal, netAmount, vatAmount: round2(lineTotal - netAmount) };
}

export function sumLines(lines: LineAmounts[]) {
  const total = round2(lines.reduce((a, l) => a + l.lineTotal, 0));
  const vatTotal = round2(lines.reduce((a, l) => a + l.vatAmount, 0));
  return { total, vatTotal, netTotal: round2(total - vatTotal) };
}

export interface PaymentInput {
  method: 'cash' | 'card';
  amount: number;
  tendered?: number;
  reference?: string;
}

export interface AppliedPayment {
  method: 'cash' | 'card';
  amount: number;
  tendered: number | null;
  reference: string | null;
}

/**
 * Checks the payments cover the total exactly and works out change.
 * `amount` is what is applied to the bill; cash may be tendered above it.
 */
export function applyPayments(total: number, payments: PaymentInput[]): { applied: AppliedPayment[]; changeDue: number } {
  if (!payments.length) {
    // Loyalty points can cover a whole bill, leaving nothing to pay.
    if (total === 0) return { applied: [], changeDue: 0 };
    throw new BadRequestException('At least one payment is required');
  }

  const paid = round2(payments.reduce((a, p) => a + p.amount, 0));
  if (paid < total) throw new BadRequestException(`Payment of ${paid.toFixed(2)} does not cover the total of ${total.toFixed(2)}`);
  if (paid > total) throw new BadRequestException(`Payments applied (${paid.toFixed(2)}) exceed the total of ${total.toFixed(2)}; use "tendered" for cash given`);

  let changeDue = 0;
  const applied = payments.map((p): AppliedPayment => {
    if (p.amount <= 0) throw new BadRequestException('Payment amounts must be greater than zero');
    if (p.method === 'cash') {
      const tendered = round2(p.tendered ?? p.amount);
      if (tendered < p.amount) throw new BadRequestException('Cash tendered is less than the cash amount');
      changeDue = round2(changeDue + (tendered - p.amount));
      return { method: 'cash', amount: p.amount, tendered, reference: null };
    }
    if (p.tendered !== undefined && p.tendered !== p.amount) {
      throw new BadRequestException('Card payments cannot have a tendered amount different from the amount');
    }
    return { method: 'card', amount: p.amount, tendered: null, reference: p.reference ?? null };
  });
  return { applied, changeDue };
}

export const formatReceiptNumber = (seq: number): string => `R-${String(seq).padStart(6, '0')}`;
