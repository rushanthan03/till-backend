import { applyUpdate, defaultPermissions, diffPermissions, levelFor, levelsFor, mergePermissions } from './permissions';
import { productChanges } from '../product/product.service';

describe('role permissions', () => {
  it('defaults keep how the till worked before', () => {
    const d = defaultPermissions();
    expect(d.cashier.discounts).toBe('pin');
    expect(d.cashier.paidOut).toBe('pin');
    expect(d.cashier.refunds).toBe('no');
    expect(d.cashier.noSale).toBe('yes');
    expect(d.manager.products).toBe('yes');
    expect(d.manager.audit).toBe('no');
    expect(d.cashier.products).toBe('no');
  });

  it('admins can always do everything; unknown roles nothing', () => {
    const p = mergePermissions({ manager: { refunds: 'no' } });
    expect(levelFor(p, 'tenant_admin', 'refunds')).toBe('yes');
    expect(levelFor(p, 'super_admin', 'audit')).toBe('yes');
    expect(levelFor(p, 'manager', 'refunds')).toBe('no');
    expect(levelFor(p, 'someone', 'noSale')).toBe('no');
    expect(levelFor(p, undefined, 'noSale')).toBe('no');
  });

  it('ignores stored values that are not allowed for the role', () => {
    const p = mergePermissions({ manager: { discounts: 'pin', bogus: 'yes' }, cashier: { products: 'yes', refunds: 'pin' }, other: {} });
    expect(p.manager.discounts).toBe('yes'); // managers can't be "pin"
    expect(p.cashier.products).toBe('no'); // cashiers have no back office
    expect(p.cashier.refunds).toBe('pin');
    expect(mergePermissions(null)).toEqual(defaultPermissions());
    expect(mergePermissions('junk')).toEqual(defaultPermissions());
  });

  it('applies a partial update and rejects bad ones', () => {
    const cur = defaultPermissions();
    const ok = applyUpdate(cur, { cashier: { refunds: 'pin' } });
    expect(ok.value?.cashier.refunds).toBe('pin');
    expect(ok.value?.cashier.discounts).toBe('pin');
    expect(cur.cashier.refunds).toBe('no'); // original untouched
    expect(applyUpdate(cur, { owner: {} }).error).toMatch(/Unknown role/);
    expect(applyUpdate(cur, { cashier: { flying: 'yes' } }).error).toMatch(/Unknown permission/);
    expect(applyUpdate(cur, { cashier: { stock: 'yes' } }).error).toMatch(/not an option/);
    expect(applyUpdate(cur, { manager: { refunds: 'pin' } }).error).toMatch(/not an option/);
    expect(applyUpdate(cur, null).error).toBeTruthy();
  });

  it('lists what changed', () => {
    const a = defaultPermissions();
    const b = applyUpdate(a, { cashier: { refunds: 'pin' }, manager: { audit: 'yes' } }).value!;
    expect(diffPermissions(a, b)).toEqual([
      { role: 'manager', key: 'audit', label: 'Audit log', from: 'no', to: 'yes' },
      { role: 'cashier', key: 'refunds', label: 'Refunds', from: 'no', to: 'pin' },
    ]);
    expect(diffPermissions(a, a)).toEqual([]);
  });

  it('gives every permission a level for a role', () => {
    const l = levelsFor(defaultPermissions(), 'cashier');
    expect(Object.keys(l)).toHaveLength(12);
    expect(l.reports).toBe('no');
  });
});

describe('productChanges', () => {
  it('compares numbers as numbers and skips unchanged fields', () => {
    const before = { name: 'Milk', price: 1.5, costPrice: null, isActive: true, imageUrl: 'a' };
    const after = { name: 'Milk', price: '1.50', costPrice: 0.9, isActive: false, imageUrl: 'b' };
    expect(productChanges(before, after, ['name', 'price', 'costPrice', 'isActive', 'imageUrl'])).toEqual([
      { field: 'costPrice', from: null, to: 0.9 },
      { field: 'isActive', from: true, to: false },
    ]);
  });
});

import { applyFeatureUpdate, mergeFeatures } from './company-features';

describe('company features', () => {
  it('are off until switched on', () => {
    expect(mergeFeatures(undefined)).toEqual({ emailReceipts: false });
    expect(mergeFeatures({ emailReceipts: 'yes' })).toEqual({ emailReceipts: false });
    expect(mergeFeatures({ emailReceipts: true, other: 1 })).toEqual({ emailReceipts: true });
  });

  it('only accept known features set to true or false', () => {
    expect(applyFeatureUpdate({ emailReceipts: false }, { emailReceipts: true }).value).toEqual({ emailReceipts: true });
    expect(applyFeatureUpdate({ emailReceipts: false }, { emailReceipts: 'on' }).error).toBe('Email receipts must be on or off');
    expect(applyFeatureUpdate({ emailReceipts: false }, { smsReceipts: true }).error).toBe('Unknown setting "smsReceipts"');
  });
});
