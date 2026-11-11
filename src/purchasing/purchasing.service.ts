import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { Product, ProductUnitType } from '../infrastructure/database/entities/product.entity';
import { Restaurant } from '../infrastructure/database/entities/restaurant.entity';
import { Supplier } from '../infrastructure/database/entities/supplier.entity';
import { PurchaseOrder, PurchaseOrderLine, PurchaseOrderStatus } from '../infrastructure/database/entities/purchase-order.entity';
import { StockMovementType } from '../infrastructure/database/entities/stock-movement.entity';
import { recordStockMovements } from '../stock/stock-ledger';
import { round2, round3 } from '../sales/sale-calculations';
import {
  CreatePurchaseOrderDto, CreateSupplierDto, ListPurchaseOrdersQueryDto, ListSuppliersQueryDto, PoLineDto, ReceivePurchaseOrderDto, UpdatePurchaseOrderDto, UpdateSupplierDto,
} from './dto/purchasing.dto';
import { addDays, formatPoNumber, orderTotal, statusAfterReceipt, suggestedQuantity } from './purchasing-calculations';

type Actor = { id: string; name: string };
const OPEN = [PurchaseOrderStatus.ORDERED, PurchaseOrderStatus.PARTIAL];
const trimOrNull = (v?: string | null) => (v === undefined ? undefined : v?.trim() || null);

@Injectable()
export class PurchasingService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Supplier) private readonly suppliers: Repository<Supplier>,
    @InjectRepository(PurchaseOrder) private readonly orders: Repository<PurchaseOrder>,
    @InjectRepository(Product) private readonly products: Repository<Product>,
    @InjectRepository(Restaurant) private readonly stores: Repository<Restaurant>,
  ) {}

  private async tenantOf(storeId: string): Promise<string> {
    const store = await this.stores.findOne({ where: { id: storeId }, select: ['id', 'tenantId'] });
    if (!store?.tenantId) throw new NotFoundException('Store not found');
    return store.tenantId;
  }

  // ---------------- suppliers (shared by the company's stores) ----------------

  async listSuppliers(storeId: string, q: ListSuppliersQueryDto) {
    const tenantId = await this.tenantOf(storeId);
    const qb = this.suppliers.createQueryBuilder('s').where('s.tenantId = :tenantId', { tenantId });
    if ((q.status ?? 'active') === 'active') qb.andWhere('s.isActive = true');
    if (q.status === 'inactive') qb.andWhere('s.isActive = false');
    if (q.search?.trim()) {
      qb.andWhere('(s.name ILIKE :t OR s.contactName ILIKE :t OR s.email ILIKE :t OR s.accountNumber ILIKE :t)', { t: `%${q.search.trim()}%` });
    }
    const list = await qb.orderBy('s.name', 'ASC').getMany();
    if (!list.length) return [];
    // Per supplier for this store: products they usually supply and orders still to arrive.
    const ids = list.map((s) => s.id);
    const productCounts = await this.products
      .createQueryBuilder('p').select('p.supplierId', 'id').addSelect('COUNT(*)', 'n')
      .where('p.storeId = :storeId AND p.supplierId IN (:...ids) AND p.isActive = true', { storeId, ids })
      .groupBy('p.supplierId').getRawMany();
    const openOrders = await this.orders
      .createQueryBuilder('o').select('o.supplierId', 'id').addSelect('COUNT(*)', 'n')
      .where('o.storeId = :storeId AND o.supplierId IN (:...ids) AND o.status IN (:...open)', { storeId, ids, open: OPEN })
      .groupBy('o.supplierId').getRawMany();
    const count = (rows: { id: string; n: string }[], id: string) => Number(rows.find((r) => r.id === id)?.n ?? 0);
    return list.map((s) => ({ ...s, productCount: count(productCounts, s.id), openOrders: count(openOrders, s.id) }));
  }

  async getSupplier(id: string, storeId: string): Promise<Supplier> {
    const tenantId = await this.tenantOf(storeId);
    const s = await this.suppliers.findOne({ where: { id, tenantId } });
    if (!s) throw new NotFoundException('Supplier not found');
    return s;
  }

  private async assertNameFree(tenantId: string, name: string, exceptId?: string) {
    const clash = await this.suppliers.createQueryBuilder('s')
      .where('s.tenantId = :tenantId AND LOWER(s.name) = LOWER(:name)', { tenantId, name })
      .getOne();
    if (clash && clash.id !== exceptId) throw new ConflictException(`A supplier called ${clash.name} already exists`);
  }

  async createSupplier(storeId: string, dto: CreateSupplierDto) {
    const tenantId = await this.tenantOf(storeId);
    const name = dto.name.trim();
    await this.assertNameFree(tenantId, name);
    return this.suppliers.save(this.suppliers.create({
      tenantId, name,
      contactName: trimOrNull(dto.contactName) ?? null, email: trimOrNull(dto.email) ?? null, phone: trimOrNull(dto.phone) ?? null,
      address: trimOrNull(dto.address) ?? null, accountNumber: trimOrNull(dto.accountNumber) ?? null,
      leadTimeDays: dto.leadTimeDays ?? null, notes: trimOrNull(dto.notes) ?? null, isActive: dto.isActive ?? true,
    }));
  }

  async updateSupplier(id: string, storeId: string, dto: UpdateSupplierDto) {
    const s = await this.getSupplier(id, storeId);
    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name) throw new BadRequestException('Name cannot be empty');
      await this.assertNameFree(s.tenantId, name, s.id);
      s.name = name;
    }
    for (const k of ['contactName', 'email', 'phone', 'address', 'accountNumber', 'notes'] as const) {
      const v = trimOrNull(dto[k]);
      if (v !== undefined) s[k] = v;
    }
    if (dto.leadTimeDays !== undefined) s.leadTimeDays = dto.leadTimeDays;
    if (dto.isActive !== undefined) s.isActive = dto.isActive;
    return this.suppliers.save(s);
  }

  // ---------------- purchase orders (per store) ----------------

  async listOrders(storeId: string, q: ListPurchaseOrdersQueryDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 25;
    const qb = this.orders.createQueryBuilder('o')
      .leftJoin('o.supplier', 's').addSelect(['s.id', 's.name'])
      .loadRelationCountAndMap('o.lineCount', 'o.lines')
      .where('o.storeId = :storeId', { storeId });
    if (q.status) qb.andWhere('o.status = :status', { status: q.status });
    if (q.open === 'true') qb.andWhere('o.status IN (:...open)', { open: [PurchaseOrderStatus.DRAFT, ...OPEN] });
    if (q.supplierId) qb.andWhere('o.supplierId = :sid', { sid: q.supplierId });
    if (q.search?.trim()) qb.andWhere('(o.number ILIKE :t OR s.name ILIKE :t)', { t: `%${q.search.trim()}%` });
    const [data, total] = await qb.orderBy('o.createdAt', 'DESC').skip((page - 1) * limit).take(limit).getManyAndCount();
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /** One order with its lines, each with the product's current stock (for the receiving screen). */
  async getOrder(id: string, storeId: string) {
    const o = await this.orders.findOne({ where: { id, storeId }, relations: ['supplier', 'lines'] });
    if (!o) throw new NotFoundException('Purchase order not found');
    o.lines.sort((a, b) => a.sortOrder - b.sortOrder);
    const stock = await this.products.find({ where: { id: In(o.lines.map((l) => l.productId)) }, select: ['id', 'stockQuantity', 'unitType', 'costPrice'] });
    const byId = new Map(stock.map((p) => [p.id, p]));
    return {
      ...o,
      lines: o.lines.map((l) => ({
        ...l,
        outstanding: round3(Math.max(0, l.quantity - l.receivedQuantity)),
        stockQuantity: byId.get(l.productId)?.stockQuantity ?? null,
        unitType: byId.get(l.productId)?.unitType ?? ProductUnitType.EACH,
      })),
    };
  }

  /** Checks lines against the store's products and builds order lines (cost defaults to the product cost). */
  private async buildLines(m: EntityManager, storeId: string, lines: PoLineDto[]): Promise<Partial<PurchaseOrderLine>[]> {
    const ids = lines.map((l) => l.productId);
    if (new Set(ids).size !== ids.length) throw new BadRequestException('Each product can only appear once on an order');
    const found = await m.find(Product, { where: { id: In(ids), storeId } });
    if (found.length !== ids.length) throw new BadRequestException('One or more products do not exist in this store');
    const byId = new Map(found.map((p) => [p.id, p]));
    return lines.map((l, i) => {
      const p = byId.get(l.productId)!;
      if (p.unitType === ProductUnitType.EACH && !Number.isInteger(l.quantity)) throw new BadRequestException(`${p.name} is ordered in whole units`);
      return { productId: p.id, productName: p.name, barcode: p.barcode, quantity: l.quantity, unitCost: l.unitCost ?? p.costPrice ?? 0, receivedQuantity: 0, sortOrder: i };
    });
  }

  private async activeSupplier(storeId: string, supplierId: string) {
    const s = await this.getSupplier(supplierId, storeId);
    if (!s.isActive) throw new BadRequestException(`${s.name} is marked inactive`);
    return s;
  }

  async createOrder(storeId: string, user: Actor, dto: CreatePurchaseOrderDto) {
    const supplier = await this.activeSupplier(storeId, dto.supplierId);
    // Per-store numbers: next = highest + 1. Two people saving at the same moment clash on the
    // unique index, and the loser simply tries again with the next number.
    for (let attempt = 0; ; attempt++) {
      try {
        const id = await this.dataSource.transaction(async (m) => {
          const lines = await this.buildLines(m, storeId, dto.lines);
          const last = await m.createQueryBuilder(PurchaseOrder, 'o').select('COALESCE(MAX(o.seq), 0)', 'max').where('o.storeId = :storeId', { storeId }).getRawOne();
          const seq = Number(last?.max ?? 0) + 1;
          const submit = !!dto.submit;
          const order = await m.save(m.create(PurchaseOrder, {
            storeId, supplierId: supplier.id, seq, number: formatPoNumber(seq),
            status: submit ? PurchaseOrderStatus.ORDERED : PurchaseOrderStatus.DRAFT,
            expectedDate: dto.expectedDate?.slice(0, 10) ?? (submit && supplier.leadTimeDays !== null ? addDays(supplier.leadTimeDays) : null),
            notes: dto.notes?.trim() || null,
            totalCost: orderTotal(lines as { quantity: number; unitCost: number }[]),
            createdById: user.id, createdByName: user.name, orderedAt: submit ? new Date() : null,
          }));
          await m.save(lines.map((l) => m.create(PurchaseOrderLine, { ...l, purchaseOrderId: order.id })));
          return order.id;
        });
        return this.getOrder(id, storeId);
      } catch (e: any) {
        if (e?.code === '23505' && attempt < 3) continue;
        throw e;
      }
    }
  }

  /** Drafts can be changed freely; once ordered, an order is only received or cancelled. */
  async updateOrder(id: string, storeId: string, dto: UpdatePurchaseOrderDto) {
    await this.dataSource.transaction(async (m) => {
      const o = await m.findOne(PurchaseOrder, { where: { id, storeId }, lock: { mode: 'pessimistic_write' } });
      if (!o) throw new NotFoundException('Purchase order not found');
      if (o.status !== PurchaseOrderStatus.DRAFT) throw new BadRequestException('Only draft orders can be changed');
      if (dto.supplierId && dto.supplierId !== o.supplierId) o.supplierId = (await this.activeSupplier(storeId, dto.supplierId)).id;
      if (dto.expectedDate !== undefined) o.expectedDate = dto.expectedDate ? dto.expectedDate.slice(0, 10) : null;
      if (dto.notes !== undefined) o.notes = dto.notes?.trim() || null;
      if (dto.lines) {
        const lines = await this.buildLines(m, storeId, dto.lines);
        await m.delete(PurchaseOrderLine, { purchaseOrderId: o.id });
        await m.save(lines.map((l) => m.create(PurchaseOrderLine, { ...l, purchaseOrderId: o.id })));
        o.totalCost = orderTotal(lines as { quantity: number; unitCost: number }[]);
      }
      await m.save(PurchaseOrder, o);
    });
    return this.getOrder(id, storeId);
  }

  /** Draft -> ordered (sent to the supplier). */
  async submitOrder(id: string, storeId: string) {
    await this.dataSource.transaction(async (m) => {
      const o = await m.findOne(PurchaseOrder, { where: { id, storeId }, lock: { mode: 'pessimistic_write' } });
      if (!o) throw new NotFoundException('Purchase order not found');
      if (o.status !== PurchaseOrderStatus.DRAFT) throw new BadRequestException('Only a draft can be marked as ordered');
      const supplier = await this.activeSupplier(storeId, o.supplierId);
      o.status = PurchaseOrderStatus.ORDERED;
      o.orderedAt = new Date();
      if (!o.expectedDate && supplier.leadTimeDays !== null) o.expectedDate = addDays(supplier.leadTimeDays);
      await m.save(PurchaseOrder, o);
    });
    return this.getOrder(id, storeId);
  }

  /** Cancels a draft or an order still to arrive. On a part-delivered order it cancels the rest; stock already booked in stays. */
  async cancelOrder(id: string, storeId: string) {
    await this.dataSource.transaction(async (m) => {
      const o = await m.findOne(PurchaseOrder, { where: { id, storeId }, lock: { mode: 'pessimistic_write' } });
      if (!o) throw new NotFoundException('Purchase order not found');
      if (![PurchaseOrderStatus.DRAFT, ...OPEN].includes(o.status)) throw new BadRequestException(`A ${o.status} order cannot be cancelled`);
      o.status = PurchaseOrderStatus.CANCELLED;
      o.closedAt = new Date();
      await m.save(PurchaseOrder, o);
    });
    return this.getOrder(id, storeId);
  }

  /**
   * Books a delivery against the order: stock goes up, each line records what arrived, and the
   * stock history gets a goods-in entry referencing the PO. Can be done in several deliveries.
   */
  async receiveOrder(id: string, storeId: string, user: Actor, dto: ReceivePurchaseOrderDto) {
    const lineIds = dto.lines.map((l) => l.lineId);
    if (new Set(lineIds).size !== lineIds.length) throw new BadRequestException('Each line can only be received once per delivery');
    const arriving = dto.lines.filter((l) => l.quantity > 0);
    if (!arriving.length) throw new BadRequestException('Enter the quantity that arrived for at least one line');
    const updateCost = dto.updateCostPrices ?? true;
    const note = dto.deliveryNote?.trim() || null;

    const result = await this.dataSource.transaction(async (m) => {
      // Lock the order row first so two people booking the same delivery can't both count it.
      const locked = await m.findOne(PurchaseOrder, { where: { id, storeId }, lock: { mode: 'pessimistic_write' } });
      if (!locked) throw new NotFoundException('Purchase order not found');
      const o = (await m.findOne(PurchaseOrder, { where: { id }, relations: ['supplier', 'lines'] }))!;
      if (!OPEN.includes(o.status)) {
        throw new BadRequestException(o.status === PurchaseOrderStatus.DRAFT ? 'Mark the order as ordered before receiving it' : `This order is already ${o.status}`);
      }
      const lineById = new Map(o.lines.map((l) => [l.id, l]));
      if (arriving.some((l) => !lineById.has(l.lineId))) throw new BadRequestException('A line does not belong to this order');

      const products = await m.find(Product, { where: { id: In(arriving.map((l) => lineById.get(l.lineId)!.productId)), storeId }, lock: { mode: 'pessimistic_write' } });
      const productById = new Map(products.map((p) => [p.id, p]));
      const entries = [];
      let units = 0;
      let cost = 0;
      for (const a of arriving) {
        const line = lineById.get(a.lineId)!;
        const p = productById.get(line.productId);
        if (!p) throw new BadRequestException(`${line.productName} no longer exists in this store`);
        if (p.unitType === ProductUnitType.EACH && !Number.isInteger(a.quantity)) throw new BadRequestException(`${p.name} is counted in whole units`);
        const unitCost = a.unitCost ?? line.unitCost;
        line.receivedQuantity = round3(line.receivedQuantity + a.quantity);
        p.stockQuantity = round3(p.stockQuantity + a.quantity);
        if (updateCost) p.costPrice = unitCost;
        units = round3(units + a.quantity);
        cost = round2(cost + a.quantity * unitCost);
        entries.push({
          storeId, productId: p.id, type: StockMovementType.GOODS_RECEIPT, quantity: a.quantity, quantityAfter: p.stockQuantity,
          unitCost, reference: o.number, supplier: o.supplier.name, reason: note ? `Delivery note ${note}` : null, userId: user.id, userName: user.name,
        });
      }
      await m.save(PurchaseOrderLine, o.lines);
      await m.save(Product, products);
      await recordStockMovements(m, entries);
      o.status = statusAfterReceipt(o.lines);
      o.receivedCost = round2(o.receivedCost + cost);
      if (o.status === PurchaseOrderStatus.RECEIVED) o.closedAt = new Date();
      await m.update(PurchaseOrder, { id: o.id }, { status: o.status, receivedCost: o.receivedCost, closedAt: o.closedAt });
      return { units, cost, status: o.status };
    });
    return { ...result, order: await this.getOrder(id, storeId) };
  }

  /**
   * What to reorder: active products at or below their reorder level, topped up to twice that level,
   * less anything already on an open order. With a supplier, only that supplier's products.
   */
  async suggestions(storeId: string, supplierId?: string) {
    const qb = this.products.createQueryBuilder('p')
      .where('p.storeId = :storeId AND p.isActive = true AND p.reorderLevel > 0 AND p.stockQuantity <= p.reorderLevel', { storeId });
    if (supplierId) qb.andWhere('p.supplierId = :supplierId', { supplierId });
    const low = await qb.orderBy('p.department', 'ASC').addOrderBy('p.name', 'ASC').getMany();
    if (!low.length) return [];
    const onOrderRows = await this.dataSource.createQueryBuilder()
      .select('l.productId', 'productId').addSelect('SUM(GREATEST(l.quantity - l.receivedQuantity, 0))', 'qty')
      .from(PurchaseOrderLine, 'l').innerJoin(PurchaseOrder, 'o', 'o.id = l.purchaseOrderId')
      .where('o.storeId = :storeId AND o.status IN (:...open) AND l.productId IN (:...ids)', { storeId, open: OPEN, ids: low.map((p) => p.id) })
      .groupBy('l.productId').getRawMany();
    const onOrder = new Map(onOrderRows.map((r) => [r.productId, Number(r.qty)]));
    return low
      .map((p) => {
        const pending = onOrder.get(p.id) ?? 0;
        return {
          productId: p.id, name: p.name, barcode: p.barcode, department: p.department, supplierId: p.supplierId,
          stockQuantity: p.stockQuantity, reorderLevel: p.reorderLevel, onOrder: pending, unitCost: p.costPrice ?? 0, unitType: p.unitType,
          suggested: suggestedQuantity(p.stockQuantity, p.reorderLevel, pending, p.unitType === ProductUnitType.EACH),
        };
      })
      .filter((s) => s.suggested > 0);
  }
}
