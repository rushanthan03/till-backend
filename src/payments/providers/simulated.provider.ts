import { randomBytes } from 'crypto';
import { ChargeRequest, ChargeResult, RefundRequest, RefundResult, TerminalProvider } from './terminal-provider';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const ref = (prefix: string) => `${prefix}-${randomBytes(4).toString('hex').toUpperCase()}`;

/**
 * Stand-in terminal for demos and development. It "reads a card" after a short pause and approves, except:
 *   - simulate: 'decline'  →  declined
 *   - amounts ending in .13 →  declined (insufficient funds)
 *   - amounts ending in .14 →  declined (card expired)
 * Never use in production: it takes no money.
 */
export class SimulatedTerminalProvider implements TerminalProvider {
  readonly name = 'simulated';
  constructor(private readonly delayMs = 2200) {}

  async charge(req: ChargeRequest): Promise<ChargeResult> {
    await sleep(this.delayMs);
    const pence = Math.round(req.amount * 100) % 100;
    if (req.simulate === 'decline') return { status: 'declined', reference: ref('SIM-DEC'), reason: 'Card declined' };
    if (pence === 13) return { status: 'declined', reference: ref('SIM-DEC'), reason: 'Insufficient funds' };
    if (pence === 14) return { status: 'declined', reference: ref('SIM-DEC'), reason: 'Card expired' };
    return { status: 'approved', reference: ref('SIM'), scheme: 'VISA', last4: '4242', authCode: randomBytes(3).toString('hex').toUpperCase() };
  }

  async refund(_req: RefundRequest): Promise<RefundResult> {
    await sleep(Math.min(this.delayMs, 800));
    return { reference: ref('SIM-RF') };
  }

  async ready() { return true; }
}
