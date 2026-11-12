import { AuditLogService } from '../audit-log/audit-log.service';
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { Product } from '../infrastructure/database/entities/product.entity';
import { StockMovement, StockMovementType } from '../infrastructure/database/entities/stock-movement.entity';
import { round2, round3 } from '../sales/sale-calculations';
import { AdjustStockDto, GoodsReceiptDto, ListMovementsQueryDto, StocktakeDto } from './dto/stock.dto';
import { recordStockMovements, signedChange, WRITE_OFF_TYPES } from './stock-ledger';

type Actor = { id: string; name: string };

@Injectable()
export class StockService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(StockMovement) private readonly movements: Repository<StockMovement>,
    private readonly audit: AuditLogService,
    @InjectRepository(Product) private readonly products: Repository<Product>,
  ) {}

  /** Locks and loads products of this store; rejects unknown ids so a typo can't touch another store's stock. */
  private async lockProducts(manager: EntityManager, storeId: string, ids: string[]): Promise<Map<string, Product>> {
    const unique = [...new Set(ids)];
    const found = await manager.find(Product, { where: { id: In(unique), storeId }, lock: { mode: 'pessimistic_write' } });
    if (found.length !== unique.length) throw new BadRequestException('One or more products do not exist in this store');
    return new Map(found.map((p) => [p.id, p]));
  }

  private assertUnits(p: Product, qty: number) {
    if (p.unitType === 'each' && !Number.isInteger(qty)) throw new BadRequestException(`${p.name} is counted in whole units`);
  }

  /** Delivery in: raises stock and, when a cost is given, updates the product's cost price. */
  async receive(storeId: string, user: Actor, dto: GoodsReceiptDto) {
    const reference = dto.reference?.trim() || `GR-${randomBytes(3).toString('hex').toUpperCase()}`;
    const r = await this.dataSource.transaction(async (manager) => {
      const byId = await this.lockProducts(manager, storeId, dto.lines.map((l) => l.productId));
      const entries = [];
      let units = 0;
      let cost = 0;
      for (const line of dto.lines) {
        const p = byId.get(line.productId)!;
        this.assertUnits(p, line.quantity);
        p.stockQuantity = round3(p.stockQuantity + line.quantity);
        if (line.costPrice !== undefined) p.costPrice = line.costPrice;
        units = round3(units + line.quantity);
        cost = round2(cost + line.quantity * (line.costPrice ?? p.costPrice ?? 0));
        entries.push({
          storeId, productId: p.id, type: StockMovementType.GOODS_RECEIPT, quantity: line.quantity, quantityAfter: p.stockQuantity,
          unitCost: line.costPrice ?? null, reference, supplier: dto.supplier?.trim() || null, userId: user.id, userName: user.name,
        });
      }
      await manager.save(Product, [...byId.values()]);
      await recordStockMovements(manager, entries);
      return { reference, lines: dto.lines.length, units, cost };
    });
    await this.audit.record({ actor: user, storeId, action: 'stock.receive', entityType: 'stock', entityId: r.reference, summary: `Booked in delivery ${r.reference}${dto.supplier ? ` from ${dto.supplier}` : ''}: ${r.lines} products, ${r.units} units` });
    return r;
  }

  /** One-off change: adjustment (signed) or write-off (waste, damaged, expired). Never takes stock below zero. */
  async adjust(storeId: string, user: Actor, dto: AdjustStockDto) {
    const reason = dto.reason?.trim();
    if (!reason) throw new BadRequestException('A reason is required');
    if (!dto.quantity) throw new BadRequestException('Quantity cannot be zero');
    if (WRITE_OFF_TYPES.includes(dto.type) && dto.quantity < 0) throw new BadRequestException('Enter the quantity as a positive number');
    const change = round3(signedChange(dto.type, dto.quantity));

    const r = await this.dataSource.transaction(async (manager) => {
      const p = (await this.lockProducts(manager, storeId, [dto.productId])).get(dto.productId)!;
      this.assertUnits(p, change);
      const after = round3(p.stockQuantity + change);
      if (after < 0) throw new BadRequestException(`${p.name}: only ${p.stockQuantity} in stock. To correct stock that is wrong, run a stocktake.`);
      p.stockQuantity = after;
      await manager.save(Product, p);
      await recordStockMovements(manager, [
        { storeId, productId: p.id, type: dto.type, quantity: change, quantityAfter: after, reason, userId: user.id, userName: user.name },
      ]);
      return { productId: p.id, name: p.name, change, stockQuantity: after };
    });
    await this.audit.record({ actor: user, storeId, action: 'stock.adjust', entityType: 'product', entityId: r.productId, summary: `${r.name}: stock ${r.change > 0 ? '+' : ''}${r.change} (${dto.type.replace(/_/g, ' ')}: ${reason}), now ${r.stockQuantity}` });
    return r;
  }

  /** Stocktake: counted quantities replace the system figures. Only lines that differ are changed and recorded. */
  async stocktake(storeId: string, user: Actor, dto: StocktakeDto) {
    const ids = dto.lines.map((l) => l.productId);
    if (new Set(ids).size !== ids.length) throw new BadRequestException('Each product can only be counted once per stocktake');
    const reference = `ST-${randomBytes(3).toString('hex').toUpperCase()}`;
    const reason = dto.name?.trim() || 'Stocktake';

    const r = await this.dataSource.transaction(async (manager) => {
      const byId = await this.lockProducts(manager, storeId, ids);
      const entries = [];
      const lines = [];
      let valueVariance = 0;
      for (const l of dto.lines) {
        const p = byId.get(l.productId)!;
        this.assertUnits(p, l.counted);
        const system = p.stockQuantity;
        const variance = round3(l.counted - system);
        const value = round2(variance * (p.costPrice ?? p.price));
        lines.push({ productId: p.id, name: p.name, barcode: p.barcode, system, counted: l.counted, variance, value });
        if (variance === 0) continue;
        valueVariance = round2(valueVariance + value);
        p.stockQuantity = l.counted;
        entries.push({
          storeId, productId: p.id, type: StockMovementType.STOCKTAKE, quantity: variance, quantityAfter: l.counted, reason, reference,
          userId: user.id, userName: user.name,
        });
      }
      await manager.save(Product, [...byId.values()]);
      await recordStockMovements(manager, entries);
      return {
        reference,
        counted: lines.length,
        changed: entries.length,
        unitsShort: round3(-lines.filter((x) => x.variance < 0).reduce((a, x) => a + x.variance, 0)),
        unitsOver: round3(lines.filter((x) => x.variance > 0).reduce((a, x) => a + x.variance, 0)),
        valueVariance,
        lines: lines.filter((x) => x.variance !== 0),
      };
    });
    await this.audit.record({ actor: user, storeId, action: 'stock.count', entityType: 'stock', entityId: r.reference, summary: `Stock count ${r.reference}: ${r.counted} products counted, ${r.changed} changed (${r.unitsShort} units short, ${r.unitsOver} over)`, details: { lines: r.lines } });
    return r;
  }

  async list(storeId: string, q: ListMovementsQueryDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 25;
    const qb = this.movements
      .createQueryBuilder('m')
      .leftJoin('m.product', 'p')
      .addSelect(['p.name', 'p.barcode'])
      .where('m.storeId = :storeId', { storeId });
    if (q.productId) qb.andWhere('m.productId = :pid', { pid: q.productId });
    if (q.type) qb.andWhere('m.type = :type', { type: q.type });
    if (q.search?.trim()) qb.andWhere('(p.name ILIKE :s OR p.barcode ILIKE :s OR m.reference ILIKE :s)', { s: `%${q.search.trim()}%` });
    if (q.from) qb.andWhere('m.createdAt >= :from', { from: new Date(q.from) });
    if (q.to) qb.andWhere('m.createdAt <= :to', { to: new Date(q.to) });
    const [data, total] = await qb.orderBy('m.createdAt', 'DESC').skip((page - 1) * limit).take(limit).getManyAndCount();
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /** Headline stock figures for active products. */
  async summary(storeId: string) {
    const r = await this.products
      .createQueryBuilder('p')
      .select('COUNT(*)', 'products')
      .addSelect('COUNT(*) FILTER (WHERE p.stockQuantity <= 0)', 'out')
      .addSelect('COUNT(*) FILTER (WHERE p.stockQuantity < 0)', 'negative')
      .addSelect('COUNT(*) FILTER (WHERE p.stockQuantity > 0 AND p.stockQuantity <= p.reorderLevel)', 'low')
      .addSelect('COALESCE(SUM(GREATEST(p.stockQuantity, 0) * COALESCE(p.costPrice, 0)), 0)', 'costValue')
      .addSelect('COALESCE(SUM(GREATEST(p.stockQuantity, 0) * p.price), 0)', 'retailValue')
      .where('p.storeId = :storeId AND p.isActive = true', { storeId })
      .getRawOne();
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const w = await this.movements
      .createQueryBuilder('m')
      .innerJoin('m.product', 'p')
      .select('COALESCE(SUM(-m.quantity * COALESCE(p.costPrice, p.price)), 0)', 'value')
      .where('m.storeId = :storeId AND m.type IN (:...types) AND m.createdAt >= :since', { storeId, types: WRITE_OFF_TYPES, since })
      .getRawOne();
    return {
      products: Number(r.products),
      outOfStock: Number(r.out),
      negativeStock: Number(r.negative),
      lowStock: Number(r.low),
      costValue: round2(Number(r.costValue)),
      retailValue: round2(Number(r.retailValue)),
      writtenOff30Days: round2(Number(w.value)),
    };
  }
}
