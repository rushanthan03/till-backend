import { ProductUnitType } from '../infrastructure/database/entities/product.entity';
import { changedFields, formatExtraBarcodes, mapHeaders, parseExtraBarcodes, parseImportRow, sameExtras } from './product-import';

describe('product import rows', () => {
  it('maps headings regardless of case, spaces and common aliases', () => {
    expect(mapHeaders({ 'Bar Code': '123', EAN: 'x', 'VAT %': '20', Stock: '5', 'Pack barcodes': 'a' })).toEqual({
      barcode: 'x', vatRate: '20', stockQuantity: '5', extraBarcodes: 'a',
    });
  });

  it('parses a full row', () => {
    const r = parseImportRow({
      barcode: '5000000000017', name: 'Whole Milk 2L', department: 'Dairy', price: '£1.65', vatRate: '0%',
      unitType: 'each', ageRestriction: '18+', stockQuantity: '24', isActive: 'yes', extraBarcodes: '5000000000024:6:Six pack; 5000000000031:24',
    });
    expect(r.errors).toEqual([]);
    expect(r.fields).toEqual({
      name: 'Whole Milk 2L', department: 'Dairy', price: 1.65, vatRate: 0, unitType: ProductUnitType.EACH,
      ageRestriction: 18, stockQuantity: 24, isActive: true,
    });
    expect(r.extraBarcodes).toEqual([
      { barcode: '5000000000024', packQuantity: 6, label: 'Six pack' },
      { barcode: '5000000000031', packQuantity: 24, label: null },
    ]);
  });

  it('leaves blank cells out so existing values are kept, and keeps extras undefined when blank', () => {
    const r = parseImportRow({ barcode: '123456', name: '', price: '' , extraBarcodes: '' });
    expect(r.fields).toEqual({});
    expect(r.extraBarcodes).toBeUndefined();
  });

  it('reports bad values', () => {
    const r = parseImportRow({ barcode: 'a b', price: '1.234', vatRate: '120', unitType: 'box', ageRestriction: '1.5', isActive: 'maybe' });
    expect(r.errors).toHaveLength(6);
  });

  it('strips the apostrophe our export adds to formula-like text', () => {
    expect(parseImportRow({ barcode: '123456', name: "'=Promo" }).fields.name).toBe('=Promo');
  });

  it('checks extra barcodes', () => {
    const errors: string[] = [];
    expect(parseExtraBarcodes('111111:0; 22:2; 333333:2; 333333:3', errors)).toEqual([{ barcode: '333333', packQuantity: 2, label: null }]);
    expect(errors).toHaveLength(3);
    expect(parseImportRow({ barcode: '123456', extraBarcodes: '123456:6' }).errors).toContain('An extra barcode is the same as the main barcode');
  });

  it('formats extras back to the import format', () => {
    const list = [{ barcode: 'A123', packQuantity: 6, label: 'Six' }, { barcode: 'B123', packQuantity: 1, label: null }];
    expect(formatExtraBarcodes(list)).toBe('A123:6:Six; B123:1');
    const errors: string[] = [];
    expect(parseExtraBarcodes(formatExtraBarcodes(list), errors)).toEqual(list);
    expect(sameExtras(list, [...list].reverse())).toBe(true);
  });

  it('lists only fields that change, never stock', () => {
    expect(changedFields({ name: 'Milk', price: 1.65, stockQuantity: 3 }, { name: 'Milk', price: 1.75, stockQuantity: 9 })).toEqual(['price']);
  });
});
