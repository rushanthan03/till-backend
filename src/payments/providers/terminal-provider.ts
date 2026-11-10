/**
 * A card terminal / payment provider. To connect a real one (Stripe Terminal, Worldpay, Adyen, SumUp...)
 * write a class that implements this interface and register it in payments.service.ts under a name that
 * PAYMENT_PROVIDER can select. Nothing else in the till needs to change.
 */
export interface ChargeRequest {
  amount: number;
  /** Idempotency key: the same value must never charge twice. */
  clientRef: string;
  /** Only the simulated provider honours this (demos and tests). */
  simulate?: 'decline';
}

export type ChargeResult =
  | { status: 'approved'; reference: string; scheme?: string; last4?: string; authCode?: string }
  | { status: 'declined'; reference: string; reason: string };

export interface RefundRequest {
  /** Reference of the original charge. */
  reference: string;
  amount: number;
  clientRef: string;
}

export interface RefundResult {
  reference: string;
}

export interface TerminalProvider {
  readonly name: string;
  /** Asks the customer to present their card and waits for the result. Throws if the terminal cannot be reached. */
  charge(req: ChargeRequest): Promise<ChargeResult>;
  refund(req: RefundRequest): Promise<RefundResult>;
  /** Is the terminal reachable? */
  ready(): Promise<boolean>;
}
