/**
 * Optional features the company admin switches on in Settings. Kept in the tenant's settings under
 * `features`. Everything here is off until switched on.
 */
export interface CompanyFeatures {
  /** Staff can email a receipt (or gift receipt) to the customer. Needs SMTP set up on the server. */
  emailReceipts: boolean;
}

export const DEFAULT_FEATURES: CompanyFeatures = { emailReceipts: false };

export const FEATURE_LABELS: Record<keyof CompanyFeatures, string> = { emailReceipts: 'Email receipts' };

export function mergeFeatures(stored: unknown): CompanyFeatures {
  const out = { ...DEFAULT_FEATURES };
  if (!stored || typeof stored !== 'object') return out;
  for (const k of Object.keys(DEFAULT_FEATURES) as (keyof CompanyFeatures)[]) {
    const v = (stored as any)[k];
    if (typeof v === 'boolean') out[k] = v;
  }
  return out;
}

/** Checks an update: only known features, only true/false. */
export function applyFeatureUpdate(current: CompanyFeatures, input: unknown): { value?: CompanyFeatures; error?: string } {
  if (!input || typeof input !== 'object') return { error: 'Send the features to change' };
  const next = { ...current };
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (!(k in DEFAULT_FEATURES)) return { error: `Unknown setting "${k}"` };
    if (typeof v !== 'boolean') return { error: `${FEATURE_LABELS[k as keyof CompanyFeatures]} must be on or off` };
    next[k as keyof CompanyFeatures] = v;
  }
  return { value: next };
}
