import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets, DataSource, EntityManager, In } from 'typeorm';
import { StockMovementType } from '../infrastructure/database/entities/stock-movement.entity';
import { recordStockMovements } from '../stock/stock-ledger';
import { Product, ProductUnitType } from '../infrastructure/database/entities/product.entity';
import { ProductBarcode } from '../infrastructure/database/entities/product-barcode.entity';
import { Supplier } from '../infrastructure/database/entities/supplier.entity';
import { Restaurant } from '../infrastructure/database/entities/restaurant.entity';
import { CreateProductDto, UpdateProductDto, ListProductsQueryDto, ProductBarcodeDto } from './dto/product.dto';
import { buildSeedRows } from './product.seed';
import { ExtraBarcode, MAX_IMPORT_ROWS, ParsedRow, changedFields, parseImportRow, sameExtras } from './product-import';

/** A product as the API returns it: with its extra (pack) barcodes. */
export type ProductView = Product & { barcodes: ExtraBarcode[] };
/** A barcode lookup also says how many units one scan of that barcode is. */
export type ScannedProduct = ProductView & { scannedBarcode: string; scanQuantity: number; scanLabel: string | null };

export type ImportAction = 'create' | 'update' | 'unchanged' | 'error';
export interface ImportRowResult {
  line: number;
  barcode: string;
  name: string | null;
  action: ImportAction;
  changes: string[];
  errors: string[];
  warnings: string[];
}

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(ProductBarcode)
    private readonly barcodeRepository: Repository<ProductBarcode>,
    @InjectRepository(Supplier)
    private readonly supplierRepository: Repository<Supplier>,
    @InjectRepository(Restaurant)
    private readonly storeRepository: Repository<Restaurant>,
    private readonly dataSource: DataSource,
  ) {}

  /** Adds each product's extra barcodes (one query for the whole page). */
  private async withBarcodes(products: Product[], manager: EntityManager = this.dataSource.manager): Promise<ProductView[]> {
    if (!products.length) return [];
    const rows = await manager.find(ProductBarcode, {
      where: { productId: In(products.map((p) => p.id)) },
      order: { packQuantity: 'ASC', barcode: 'ASC' },
    });
    const byProduct = new Map<string, ExtraBarcode[]>();
    rows.forEach((r) => {
      const list = byProduct.get(r.productId) ?? [];
      list.push({ barcode: r.barcode, packQuantity: r.packQuantity, label: r.label });
      byProduct.set(r.productId, list);
    });
    return products.map((p) => Object.assign(p, { barcodes: byProduct.get(p.id) ?? [] }));
  }

  async findAll(storeId: string, query: ListProductsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;

    const qb = this.productRepository
      .createQueryBuilder('p')
      .where('p.storeId = :storeId', { storeId });

    if (query.search?.trim()) {
      const term = `%${query.search.trim()}%`;
      qb.andWhere(
        new Brackets((b) => {
          b.where('p.name ILIKE :term', { term })
            .orWhere('p.barcode ILIKE :term', { term })
            .orWhere('p.sku ILIKE :term', { term })
            .orWhere('p.brand ILIKE :term', { term })
            .orWhere('EXISTS (SELECT 1 FROM product_barcodes pb WHERE pb."productId" = p.id AND pb.barcode ILIKE :term)', { term });
        }),
      );
    }
    if (query.department) qb.andWhere('p.department = :department', { department: query.department });
    if (query.status === 'active') qb.andWhere('p.isActive = true');
    if (query.status === 'inactive') qb.andWhere('p.isActive = false');
    if (query.lowStock === 'true') qb.andWhere('p.stockQuantity <= p.reorderLevel');

    const [rows, total] = await qb
      .orderBy('p.department', 'ASC')
      .addOrderBy('p.name', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data: await this.withBarcodes(rows), total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string, storeId: string): Promise<ProductView> {
    const product = await this.productRepository.findOne({ where: { id, storeId } });
    if (!product) throw new NotFoundException('Product not found');
    return (await this.withBarcodes([product]))[0];
  }

  /** Till lookup: main barcode, then a pack barcode, then SKU, among active products. */
  async findByBarcode(barcode: string, storeId: string): Promise<ScannedProduct> {
    const code = barcode.trim();
    let product = await this.productRepository.findOne({ where: { storeId, barcode: code, isActive: true } });
    let scanQuantity = 1;
    let scanLabel: string | null = null;
    if (!product) {
      const extra = await this.barcodeRepository.findOne({ where: { storeId, barcode: code } });
      if (extra) {
        product = await this.productRepository.findOne({ where: { id: extra.productId, storeId, isActive: true } });
        scanQuantity = extra.packQuantity;
        scanLabel = extra.label;
      }
    }
    if (!product) product = await this.productRepository.findOne({ where: { storeId, sku: code, isActive: true } });
    if (!product) throw new NotFoundException(`No active product found for barcode ${code}`);
    const [view] = await this.withBarcodes([product]);
    return Object.assign(view, { scannedBarcode: code, scanQuantity, scanLabel });
  }

  async listDepartments(storeId: string): Promise<{ department: string; count: number }[]> {
    const rows = await this.productRepository
      .createQueryBuilder('p')
      .select('p.department', 'department')
      .addSelect('COUNT(*)', 'count')
      .where('p.storeId = :storeId', { storeId })
      .groupBy('p.department')
      .orderBy('p.department', 'ASC')
      .getRawMany();
    return rows.map((r) => ({ department: r.department, count: Number(r.count) }));
  }

  /** A product's usual supplier must be one of the same company's suppliers. */
  private async assertSupplier(storeId: string, supplierId: string | null | undefined) {
    if (!supplierId) return;
    const store = await this.storeRepository.findOne({ where: { id: storeId }, select: ['id', 'tenantId'] });
    const ok = store && (await this.supplierRepository.count({ where: { id: supplierId, tenantId: store.tenantId } }));
    if (!ok) throw new BadRequestException('Supplier not found');
  }

  async create(storeId: string, dto: CreateProductDto): Promise<ProductView> {
    const { barcodes, ...fields } = dto;
    await this.assertSupplier(storeId, fields.supplierId);
    const extras = this.cleanExtras(barcodes ?? [], fields.barcode, fields.unitType ?? ProductUnitType.EACH);
    await this.assertBarcodesFree(storeId, [fields.barcode, ...extras.map((b) => b.barcode)]);
    return this.dataSource.transaction(async (m) => {
      const saved = await m.save(
        m.create(Product, {
          ...fields,
          storeId,
          sku: fields.sku ?? null,
          category: fields.category ?? null,
          brand: fields.brand ?? null,
          costPrice: fields.costPrice ?? null,
          imageUrl: fields.imageUrl ?? null,
          supplierId: fields.supplierId ?? null,
        }),
      );
      await this.replaceExtras(m, storeId, saved.id, extras);
      // Starting stock is recorded so the stock history is complete from day one.
      if (saved.stockQuantity > 0) {
        await recordStockMovements(m, [
          { storeId, productId: saved.id, type: StockMovementType.OPENING, quantity: saved.stockQuantity, quantityAfter: saved.stockQuantity, reason: 'Opening stock' },
        ]);
      }
      return (await this.withBarcodes([saved], m))[0];
    });
  }

  async update(id: string, storeId: string, dto: UpdateProductDto): Promise<ProductView> {
    const { barcodes, ...fields } = dto;
    const product = await this.productRepository.findOne({ where: { id, storeId } });
    if (!product) throw new NotFoundException('Product not found');
    await this.assertSupplier(storeId, fields.supplierId);
    const mainBarcode = fields.barcode ?? product.barcode;
    const extras = barcodes === undefined ? undefined : this.cleanExtras(barcodes, mainBarcode, fields.unitType ?? product.unitType);
    const toCheck = [...(fields.barcode && fields.barcode !== product.barcode ? [fields.barcode] : []), ...(extras ?? []).map((b) => b.barcode)];
    await this.assertBarcodesFree(storeId, toCheck, id);
    const before = product.stockQuantity;
    Object.assign(product, fields);
    return this.dataSource.transaction(async (m) => {
      const saved = await m.save(product);
      if (extras) await this.replaceExtras(m, storeId, id, extras);
      // Typing a new stock figure on the product screen still leaves a trail in the stock history.
      if (fields.stockQuantity !== undefined && saved.stockQuantity !== before) {
        await recordStockMovements(m, [
          { storeId, productId: saved.id, type: StockMovementType.ADJUSTMENT, quantity: saved.stockQuantity - before, quantityAfter: saved.stockQuantity, reason: 'Edited on product screen' },
        ]);
      }
      return (await this.withBarcodes([saved], m))[0];
    });
  }

  /** Products are archived (deactivated), never hard-deleted, so past sales stay intact. */
  async archive(id: string, storeId: string): Promise<ProductView> {
    const product = await this.productRepository.findOne({ where: { id, storeId } });
    if (!product) throw new NotFoundException('Product not found');
    product.isActive = false;
    return (await this.withBarcodes([await this.productRepository.save(product)]))[0];
  }

  /** Loads the demo catalogue; products whose barcode already exists are skipped. */
  async seedDemoProducts(storeId: string): Promise<{ created: number; skipped: number }> {
    const rows = buildSeedRows(storeId);
    const existing = await this.productRepository.find({ where: { storeId }, select: ['barcode'] });
    const taken = new Set(existing.map((e) => e.barcode));
    const toCreate = rows.filter((r) => !taken.has(r.barcode));
    if (toCreate.length) {
      await this.productRepository.save(toCreate.map((r) => this.productRepository.create(r)));
    }
    return { created: toCreate.length, skipped: rows.length - toCreate.length };
  }

  /**
   * CSV import. Rows are matched on the main barcode: a new barcode creates a product,
   * a known one updates only the cells that are filled in. With dryRun nothing is saved,
   * so the screen can show exactly what will happen. Rows with errors are skipped.
   */
  async importProducts(storeId: string, rawRows: Record<string, unknown>[], dryRun: boolean) {
    if (rawRows.length > MAX_IMPORT_ROWS) throw new BadRequestException(`At most ${MAX_IMPORT_ROWS} rows per import`);

    const products = await this.productRepository.find({ where: { storeId } });
    const extrasRows = await this.barcodeRepository.find({ where: { storeId } });
    const byBarcode = new Map(products.map((p) => [p.barcode, p]));
    const byId = new Map(products.map((p) => [p.id, p]));
    // Who owns each barcode in the store: a product id, or "new:<barcode>" for a row being created.
    const owner = new Map<string, string>();
    products.forEach((p) => owner.set(p.barcode, p.id));
    extrasRows.forEach((b) => owner.set(b.barcode, b.productId));
    const extrasOf = new Map<string, ExtraBarcode[]>();
    extrasRows.forEach((b) => extrasOf.set(b.productId, [...(extrasOf.get(b.productId) ?? []), { barcode: b.barcode, packQuantity: b.packQuantity, label: b.label }]));

    const seen = new Set<string>();
    const plan: { result: ImportRowResult; parsed: ParsedRow; product?: Product }[] = [];

    rawRows.forEach((raw, i) => {
      const parsed = parseImportRow(raw);
      const { barcode, fields } = parsed;
      const errors = [...parsed.errors];
      const warnings: string[] = [];
      const product = byBarcode.get(barcode);
      const ownKey = product ? product.id : `new:${barcode}`;

      const repeated = !!barcode && seen.has(barcode);
      if (repeated) errors.push('This barcode appears more than once in the file');
      seen.add(barcode);
      if (!product && barcode && !repeated && owner.has(barcode)) {
        errors.push(`${barcode} is already a pack barcode of ${byId.get(owner.get(barcode)!)?.name ?? 'another product'}`);
      }
      if (!product) {
        if (!fields.name) errors.push('Name is needed for a new product');
        if (!fields.department) errors.push('Department is needed for a new product');
        if (fields.price === undefined) errors.push('Price is needed for a new product');
      } else if (fields.stockQuantity !== undefined && fields.stockQuantity !== product.stockQuantity) {
        warnings.push('Stock is not changed by an import for existing products; use the Stock page');
      }
      const unitType = fields.unitType ?? product?.unitType ?? ProductUnitType.EACH;
      if (unitType === ProductUnitType.WEIGHT && parsed.extraBarcodes?.some((b) => b.packQuantity > 1)) {
        errors.push('Weighed products cannot have pack sizes above 1');
      }
      for (const b of parsed.extraBarcodes ?? []) {
        const o = owner.get(b.barcode);
        if (o && o !== ownKey) errors.push(`Extra barcode ${b.barcode} already belongs to ${byId.get(o)?.name ?? 'another row in this file'}`);
      }

      let action: ImportAction;
      let changes: string[] = [];
      if (errors.length) action = 'error';
      else if (!product) action = 'create';
      else {
        changes = changedFields(product as unknown as Record<string, unknown>, fields);
        if (parsed.extraBarcodes && !sameExtras(parsed.extraBarcodes, extrasOf.get(product.id) ?? [])) changes.push('extraBarcodes');
        action = changes.length ? 'update' : 'unchanged';
      }
      if (action !== 'error') {
        owner.set(barcode, ownKey);
        parsed.extraBarcodes?.forEach((b) => owner.set(b.barcode, ownKey));
      }
      plan.push({
        parsed,
        product,
        result: { line: i + 2, barcode, name: fields.name ?? product?.name ?? null, action, changes, errors, warnings },
      });
    });

    const summary = { create: 0, update: 0, unchanged: 0, error: 0 };
    plan.forEach((p) => summary[p.result.action]++);

    if (!dryRun && (summary.create || summary.update)) {
      await this.dataSource.transaction(async (m) => {
        for (const { result, parsed, product } of plan) {
          const { stockQuantity, ...rest } = parsed.fields;
          if (result.action === 'create') {
            const saved = await m.save(
              m.create(Product, {
                storeId, barcode: parsed.barcode, sku: null, category: null, brand: null, costPrice: null, imageUrl: null,
                ...rest, stockQuantity: stockQuantity ?? 0,
              }),
            );
            if (parsed.extraBarcodes) await this.replaceExtras(m, storeId, saved.id, parsed.extraBarcodes);
            if (saved.stockQuantity > 0) {
              await recordStockMovements(m, [
                { storeId, productId: saved.id, type: StockMovementType.OPENING, quantity: saved.stockQuantity, quantityAfter: saved.stockQuantity, reason: 'Opening stock (import)' },
              ]);
            }
          } else if (result.action === 'update' && product) {
            if (Object.keys(rest).length) await m.update(Product, { id: product.id }, rest);
            if (parsed.extraBarcodes && result.changes.includes('extraBarcodes')) await this.replaceExtras(m, storeId, product.id, parsed.extraBarcodes);
          }
        }
      });
    }

    return { dryRun, summary, rows: plan.map((p) => p.result) };
  }

  /** Every product with its extra barcodes, for the CSV export. */
  async exportAll(storeId: string): Promise<ProductView[]> {
    const rows = await this.productRepository.find({ where: { storeId }, order: { department: 'ASC', name: 'ASC' } });
    return this.withBarcodes(rows);
  }

  private cleanExtras(list: ProductBarcodeDto[], mainBarcode: string, unitType: ProductUnitType): ExtraBarcode[] {
    const out: ExtraBarcode[] = [];
    for (const b of list) {
      const code = b.barcode.trim();
      if (code === mainBarcode) throw new BadRequestException('An extra barcode cannot be the same as the main barcode');
      if (out.some((o) => o.barcode === code)) throw new BadRequestException(`Extra barcode ${code} is listed twice`);
      if (unitType === ProductUnitType.WEIGHT && b.packQuantity > 1) throw new BadRequestException('Weighed products cannot have pack sizes above 1');
      out.push({ barcode: code, packQuantity: b.packQuantity, label: b.label?.trim() || null });
    }
    return out;
  }

  private async replaceExtras(m: EntityManager, storeId: string, productId: string, extras: ExtraBarcode[]) {
    await m.delete(ProductBarcode, { productId });
    if (extras.length) await m.save(extras.map((b) => m.create(ProductBarcode, { ...b, storeId, productId })));
  }

  /** Each code must not be in use as a main or extra barcode of another product in the store. */
  private async assertBarcodesFree(storeId: string, codes: string[], exceptProductId?: string) {
    if (!codes.length) return;
    const mains = await this.productRepository.find({ where: { storeId, barcode: In(codes) }, select: ['id', 'barcode', 'name'] });
    const extras = await this.barcodeRepository.find({ where: { storeId, barcode: In(codes) } });
    const clash = mains.find((p) => p.id !== exceptProductId) ?? extras.find((b) => b.productId !== exceptProductId);
    if (clash) throw new ConflictException(`Barcode ${clash.barcode} is already used by another product in this store`);
  }
}
