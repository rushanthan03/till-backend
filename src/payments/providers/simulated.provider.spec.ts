import { SimulatedTerminalProvider } from './simulated.provider';

describe('simulated card terminal', () => {
  const t = new SimulatedTerminalProvider(0);
  const charge = (amount: number, simulate?: 'decline') => t.charge({ amount, clientRef: 'x', simulate });

  it('approves normal amounts with a reference and card details', async () => {
    const r = await charge(12.5);
    expect(r.status).toBe('approved');
    if (r.status === 'approved') { expect(r.reference).toMatch(/^SIM-/); expect(r.last4).toBe('4242'); }
  });
  it('declines when asked to', async () => {
    expect((await charge(5, 'decline')).status).toBe('declined');
  });
  it('declines test amounts ending .13 and .14 with a reason', async () => {
    const a = await charge(10.13); const b = await charge(7.14);
    expect(a).toMatchObject({ status: 'declined', reason: 'Insufficient funds' });
    expect(b).toMatchObject({ status: 'declined', reason: 'Card expired' });
  });
  it('gives every charge its own reference', async () => {
    const refs = new Set((await Promise.all([charge(1), charge(1), charge(1)])).map((r) => r.reference));
    expect(refs.size).toBe(3);
  });
  it('refunds with a reference', async () => {
    expect((await t.refund({ reference: 'SIM-1', amount: 5, clientRef: 'r' })).reference).toMatch(/^SIM-RF-/);
  });
});
