import { ProductUnitType } from '../infrastructure/database/entities/product.entity';

/**
 * Turns one CSV row (header -> text) into product fields, checking each value.
 * Blank cells mean "leave as it is" for an existing product. Rules shared by the
 * import preview and the import itself, so what the preview says is what happens.
 */

export const IMPORT_COLUMNS = [
  'barcode', 'name', 'department', 'price', 'vatRate', 'unitType', 'sku', 'category', 'brand',
  'costPrice', 'ageRestriction', 'stockQuantity', 'reorderLevel', 'isActive', 'extraBarcodes',
] as const;

export const MAX_IMPORT_ROWS = 5000;
export const BARCODE_RE = /^[A-Za-z0-9-]{3,32}$/;

export interface ExtraBarcode {
  barcode: string;
  packQuantity: number;
  label: string | null;
}

export interface ProductFields {
  name?: string;
  department?: string;
  price?: number;
  vatRate?: number;
  unitType?: ProductUnitType;
  sku?: string;
  category?: string;
  brand?: string;
  costPrice?: number;
  ageRestriction?: number;
  stockQuantity?: number;
  reorderLevel?: number;
  isActive?: boolean;
}

export interface ParsedRow {
  barcode: string;
  fields: ProductFields;
  /** undefined = the column was blank, keep the product's extra barcodes as they are. */
  extraBarcodes?: ExtraBarcode[];
  errors: string[];
}

const norm = (k: string) => k.toLowerCase().replace(/[^a-z]/g, '');
const ALIASES: Record<string, (typeof IMPORT_COLUMNS)[number]> = {
  ...Object.fromEntries(IMPORT_COLUMNS.map((c) => [norm(c), c])),
  ean: 'barcode', productname: 'name', vat: 'vatRate', unit: 'unitType', cost: 'costPrice',
  age: 'ageRestriction', stock: 'stockQuantity', reorder: 'reorderLevel', active: 'isActive',
  barcodes: 'extraBarcodes', packbarcodes: 'extraBarcodes',
};

/** Maps the file's own headings to our column names, ignoring case, spaces and punctuation. */
export function mapHeaders(row: Record<string, unknown>): Partial<Record<(typeof IMPORT_COLUMNS)[number], string>> {
  const out: Partial<Record<(typeof IMPORT_COLUMNS)[number], string>> = {};
  for (const [k, v] of Object.entries(row)) {
    const col = ALIASES[norm(k)];
    if (!col) continue;
    let s = v === null || v === undefined ? '' : String(v).trim();
    // Undo the apostrophe our own export puts in front of text that looks like a formula.
    if (/^'[=+\-@]/.test(s)) s = s.slice(1);
    out[col] = s;
  }
  return out;
}

const num = (v: string) => Number(v.replace(/^£/, '').replace(/,/g, ''));
const dp = (n: number, places: number) => Math.abs(n * 10 ** places - Math.round(n * 10 ** places)) < 1e-6;

/** "5000000000123:6:Six pack; 5000000000124:24" -> extra barcodes. */
export function parseExtraBarcodes(text: string, errors: string[]): ExtraBarcode[] {
  const out: ExtraBarcode[] = [];
  for (const part of text.split(/[;|]/).map((p) => p.trim()).filter(Boolean)) {
    const [code, qty, ...label] = part.split(':').map((x) => x.trim());
    const packQuantity = qty === undefined || qty === '' ? 1 : Number(qty);
    if (!BARCODE_RE.test(code ?? '')) { errors.push(`Extra barcode "${code}" must be 3-32 letters, digits or dashes`); continue; }
    if (!Number.isInteger(packQuantity) || packQuantity < 1 || packQuantity > 999) { errors.push(`Pack size for ${code} must be a whole number from 1 to 999`); continue; }
    if (out.some((o) => o.barcode === code)) { errors.push(`Extra barcode ${code} is listed twice`); continue; }
    out.push({ barcode: code, packQuantity, label: label.join(':') || null });
  }
  return out;
}

/** Text form used in exports, the reverse of parseExtraBarcodes. */
export const formatExtraBarcodes = (list: ExtraBarcode[]) =>
  list.map((b) => [b.barcode, b.packQuantity, b.label].filter((x) => x !== null && x !== '').join(':')).join('; ');

export function parseImportRow(raw: Record<string, unknown>): ParsedRow {
  const r = mapHeaders(raw);
  const errors: string[] = [];
  const f: ProductFields = {};
  const barcode = r.barcode ?? '';
  if (!barcode) errors.push('Barcode is missing');
  else if (!BARCODE_RE.test(barcode)) errors.push('Barcode must be 3-32 letters, digits or dashes');

  const text = (k: 'name' | 'department' | 'sku' | 'category' | 'brand', max = 120) => {
    const v = r[k];
    if (!v) return;
    if (v.length > max) errors.push(`${k} is longer than ${max} characters`);
    else f[k] = v;
  };
  text('name'); text('department'); text('sku', 64); text('category'); text('brand');

  const money = (k: 'price' | 'costPrice') => {
    const v = r[k];
    if (!v) return;
    const n = num(v);
    if (!Number.isFinite(n) || n < 0 || n > 99999999) errors.push(`${k} "${v}" is not a valid amount`);
    else if (!dp(n, 2)) errors.push(`${k} "${v}" has more than 2 decimal places`);
    else f[k] = n;
  };
  money('price'); money('costPrice');

  if (r.vatRate) {
    const n = num(r.vatRate.replace(/%$/, ''));
    if (!Number.isFinite(n) || n < 0 || n > 100) errors.push(`VAT rate "${r.vatRate}" must be 0-100`);
    else f.vatRate = n;
  }
  if (r.unitType) {
    const u = r.unitType.toLowerCase();
    if (['each', 'unit', 'item'].includes(u)) f.unitType = ProductUnitType.EACH;
    else if (['weight', 'kg', 'weighed'].includes(u)) f.unitType = ProductUnitType.WEIGHT;
    else errors.push(`Unit type "${r.unitType}" must be each or weight`);
  }
  if (r.ageRestriction) {
    const n = Number(r.ageRestriction.replace(/\+$/, ''));
    if (!Number.isInteger(n) || n < 0 || n > 99) errors.push(`Age restriction "${r.ageRestriction}" must be a whole number 0-99`);
    else f.ageRestriction = n;
  }
  const qty = (k: 'stockQuantity' | 'reorderLevel') => {
    const v = r[k];
    if (!v) return;
    const n = num(v);
    if (!Number.isFinite(n) || n < 0 || !dp(n, 3)) errors.push(`${k} "${v}" must be 0 or more (up to 3 decimals)`);
    else f[k] = n;
  };
  qty('stockQuantity'); qty('reorderLevel');
  if (r.isActive) {
    const a = r.isActive.toLowerCase();
    if (['yes', 'y', 'true', '1', 'active'].includes(a)) f.isActive = true;
    else if (['no', 'n', 'false', '0', 'archived', 'inactive'].includes(a)) f.isActive = false;
    else errors.push(`Active "${r.isActive}" must be yes or no`);
  }

  const extraBarcodes = r.extraBarcodes ? parseExtraBarcodes(r.extraBarcodes, errors) : undefined;
  if (extraBarcodes?.some((b) => b.barcode === barcode)) errors.push('An extra barcode is the same as the main barcode');

  return { barcode, fields: f, extraBarcodes, errors };
}

/** Field names whose value would change on an existing product. */
export function changedFields(current: Record<string, unknown>, fields: ProductFields): string[] {
  return Object.entries(fields)
    .filter(([k, v]) => k !== 'stockQuantity' && current[k] !== v)
    .map(([k]) => k);
}

export const sameExtras = (a: ExtraBarcode[], b: ExtraBarcode[]) =>
  formatExtraBarcodes([...a].sort((x, y) => x.barcode.localeCompare(y.barcode))) ===
  formatExtraBarcodes([...b].sort((x, y) => x.barcode.localeCompare(y.barcode)));
