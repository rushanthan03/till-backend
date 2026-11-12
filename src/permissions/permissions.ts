/**
 * What managers and cashiers may do, set once per company by the company admin.
 * Company admins and the platform super admin can always do everything.
 *
 *  - yes: allowed
 *  - pin: allowed once a manager types their PIN on the till (cashiers, till actions only)
 *  - no:  not allowed
 */
export type Level = 'yes' | 'pin' | 'no';
export type EditableRole = 'manager' | 'cashier';
export const EDITABLE_ROLES: EditableRole[] = ['manager', 'cashier'];

export type PermissionKey =
  | 'discounts'
  | 'refunds'
  | 'paidOut'
  | 'noSale'
  | 'products'
  | 'stock'
  | 'purchasing'
  | 'promotions'
  | 'customers'
  | 'reports'
  | 'staff'
  | 'audit';

export interface PermissionDef {
  key: PermissionKey;
  group: 'till' | 'office';
  label: string;
  description: string;
  /** Levels each role may be given; one level means it is fixed. */
  levels: Record<EditableRole, Level[]>;
  defaults: Record<EditableRole, Level>;
}

const TILL: Record<EditableRole, Level[]> = { manager: ['yes', 'no'], cashier: ['yes', 'pin', 'no'] };
const OFFICE: Record<EditableRole, Level[]> = { manager: ['yes', 'no'], cashier: ['no'] };

export const PERMISSIONS: PermissionDef[] = [
  { key: 'discounts', group: 'till', label: 'Discounts and price changes', description: 'Take money off a line or change its price at the till', levels: TILL, defaults: { manager: 'yes', cashier: 'pin' } },
  { key: 'refunds', group: 'till', label: 'Refunds', description: 'Give money back for returned goods', levels: TILL, defaults: { manager: 'yes', cashier: 'no' } },
  { key: 'paidOut', group: 'till', label: 'Paid outs', description: 'Take cash out of the drawer to pay for something', levels: TILL, defaults: { manager: 'yes', cashier: 'pin' } },
  { key: 'noSale', group: 'till', label: 'Open the drawer (no sale)', description: 'Open the cash drawer without a sale', levels: TILL, defaults: { manager: 'yes', cashier: 'yes' } },
  { key: 'products', group: 'office', label: 'Products and prices', description: 'Add, change, import and remove products', levels: OFFICE, defaults: { manager: 'yes', cashier: 'no' } },
  { key: 'stock', group: 'office', label: 'Stock', description: 'Book in deliveries, adjust stock and do stock counts', levels: OFFICE, defaults: { manager: 'yes', cashier: 'no' } },
  { key: 'purchasing', group: 'office', label: 'Suppliers and purchase orders', description: 'Manage suppliers, raise and receive orders', levels: OFFICE, defaults: { manager: 'yes', cashier: 'no' } },
  { key: 'promotions', group: 'office', label: 'Promotions', description: 'Create and change offers', levels: OFFICE, defaults: { manager: 'yes', cashier: 'no' } },
  { key: 'customers', group: 'office', label: 'Customer records', description: 'Change, export and erase customer records (adding a customer at the till is always allowed)', levels: OFFICE, defaults: { manager: 'yes', cashier: 'no' } },
  { key: 'reports', group: 'office', label: 'Sales and reports', description: 'Sales history, till sessions, day end and reports', levels: OFFICE, defaults: { manager: 'yes', cashier: 'no' } },
  { key: 'staff', group: 'office', label: 'Cashier till sign-in', description: "Set cashiers' employee numbers and till PINs, and see attendance", levels: OFFICE, defaults: { manager: 'yes', cashier: 'no' } },
  { key: 'audit', group: 'office', label: 'Audit log', description: "See the store's audit log", levels: OFFICE, defaults: { manager: 'no', cashier: 'no' } },
];

export const PERMISSION_KEYS = PERMISSIONS.map((p) => p.key);
const BY_KEY = new Map(PERMISSIONS.map((p) => [p.key, p]));

export type RolePermissions = Record<EditableRole, Record<PermissionKey, Level>>;

export function defaultPermissions(): RolePermissions {
  const out = { manager: {}, cashier: {} } as RolePermissions;
  for (const p of PERMISSIONS) for (const r of EDITABLE_ROLES) out[r][p.key] = p.defaults[r];
  return out;
}

/** Stored settings over the defaults, ignoring anything unknown or not allowed for that role. */
export function mergePermissions(stored: unknown): RolePermissions {
  const out = defaultPermissions();
  if (!stored || typeof stored !== 'object') return out;
  for (const r of EDITABLE_ROLES) {
    const row = (stored as any)[r];
    if (!row || typeof row !== 'object') continue;
    for (const p of PERMISSIONS) {
      const v = row[p.key];
      if (p.levels[r].includes(v)) out[r][p.key] = v;
    }
  }
  return out;
}

/** Checks a full or partial update; returns the merged result or the first problem. */
export function applyUpdate(current: RolePermissions, input: unknown): { value?: RolePermissions; error?: string } {
  if (!input || typeof input !== 'object') return { error: 'Send the permissions for manager and/or cashier' };
  const next: RolePermissions = { manager: { ...current.manager }, cashier: { ...current.cashier } };
  for (const [role, row] of Object.entries(input as Record<string, unknown>)) {
    if (!EDITABLE_ROLES.includes(role as EditableRole)) return { error: `Unknown role "${role}"` };
    if (!row || typeof row !== 'object') return { error: `Permissions for ${role} must be an object` };
    for (const [key, level] of Object.entries(row as Record<string, unknown>)) {
      const def = BY_KEY.get(key as PermissionKey);
      if (!def) return { error: `Unknown permission "${key}"` };
      if (!def.levels[role as EditableRole].includes(level as Level)) return { error: `${def.label}: "${String(level)}" is not an option for ${role}s` };
      next[role as EditableRole][key as PermissionKey] = level as Level;
    }
  }
  return { value: next };
}

/** Level a user's role has. Company and platform admins always "yes"; unknown roles "no". */
export function levelFor(perms: RolePermissions, role: string | undefined, key: PermissionKey): Level {
  const r = (role ?? '').toLowerCase();
  if (r === 'super_admin' || r === 'tenant_admin') return 'yes';
  if (r === 'manager' || r === 'cashier') return perms[r][key] ?? 'no';
  return 'no';
}

/** All levels for one role (what the till and menu need). */
export function levelsFor(perms: RolePermissions, role: string | undefined): Record<PermissionKey, Level> {
  return Object.fromEntries(PERMISSION_KEYS.map((k) => [k, levelFor(perms, role, k)])) as Record<PermissionKey, Level>;
}

export const LEVEL_WORDS: Record<Level, string> = { yes: 'allowed', pin: 'needs manager PIN', no: 'not allowed' };

export function diffPermissions(before: RolePermissions, after: RolePermissions): { role: EditableRole; key: PermissionKey; label: string; from: Level; to: Level }[] {
  const out: { role: EditableRole; key: PermissionKey; label: string; from: Level; to: Level }[] = [];
  for (const r of EDITABLE_ROLES) {
    for (const p of PERMISSIONS) {
      if (before[r][p.key] !== after[r][p.key]) out.push({ role: r, key: p.key, label: p.label, from: before[r][p.key], to: after[r][p.key] });
    }
  }
  return out;
}

export function permissionLabel(key: PermissionKey): string {
  return BY_KEY.get(key)?.label ?? key;
}
