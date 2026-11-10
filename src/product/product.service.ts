import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, FindOptionsWhere, Brackets, DataSource } from 'typeorm';
import { StockMovementType } from '../infrastructure/database/entities/stock-movement.entity';
import { recordStockMovements } from '../stock/stock-ledger';
import { Product } from '../infrastructure/database/entities/product.entity';
import { CreateProductDto, UpdateProductDto, ListProductsQueryDto } from './dto/product.dto';
import { buildSeedRows } from './product.seed';

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    private readonly dataSource: DataSource,
  ) {}

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
            .orWhere('p.brand ILIKE :term', { term });
        }),
      );
    }
    if (query.department) qb.andWhere('p.department = :department', { department: query.department });
    if (query.status === 'active') qb.andWhere('p.isActive = true');
    if (query.status === 'inactive') qb.andWhere('p.isActive = false');
    if (query.lowStock === 'true') qb.andWhere('p.stockQuantity <= p.reorderLevel');

    const [data, total] = await qb
      .orderBy('p.department', 'ASC')
      .addOrderBy('p.name', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string, storeId: string): Promise<Product> {
    const product = await this.productRepository.findOne({ where: { id, storeId } });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  /** Till lookup: exact barcode match (or SKU) among active products. */
  async findByBarcode(barcode: string, storeId: string): Promise<Product> {
    const where: FindOptionsWhere<Product>[] = [
      { storeId, barcode, isActive: true },
      { storeId, sku: barcode, isActive: true },
    ];
    const product = await this.productRepository.findOne({ where });
    if (!product) throw new NotFoundException(`No active product found for barcode ${barcode}`);
    return product;
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

  async create(storeId: string, dto: CreateProductDto): Promise<Product> {
    await this.assertBarcodeFree(storeId, dto.barcode);
    const product = this.productRepository.create({
      ...dto,
      storeId,
      sku: dto.sku ?? null,
      category: dto.category ?? null,
      brand: dto.brand ?? null,
      costPrice: dto.costPrice ?? null,
      imageUrl: dto.imageUrl ?? null,
    });
    const saved = await this.productRepository.save(product);
    // Starting stock is recorded so the stock history is complete from day one.
    if (saved.stockQuantity > 0) {
      await recordStockMovements(this.dataSource.manager, [
        { storeId, productId: saved.id, type: StockMovementType.OPENING, quantity: saved.stockQuantity, quantityAfter: saved.stockQuantity, reason: 'Opening stock' },
      ]);
    }
    return saved;
  }

  async update(id: string, storeId: string, dto: UpdateProductDto): Promise<Product> {
    const product = await this.findOne(id, storeId);
    if (dto.barcode && dto.barcode !== product.barcode) {
      await this.assertBarcodeFree(storeId, dto.barcode);
    }
    const before = product.stockQuantity;
    Object.assign(product, dto);
    const saved = await this.productRepository.save(product);
    // Typing a new stock figure on the product screen still leaves a trail in the stock history.
    if (dto.stockQuantity !== undefined && saved.stockQuantity !== before) {
      await recordStockMovements(this.dataSource.manager, [
        { storeId, productId: saved.id, type: StockMovementType.ADJUSTMENT, quantity: saved.stockQuantity - before, quantityAfter: saved.stockQuantity, reason: 'Edited on product screen' },
      ]);
    }
    return saved;
  }

  /** Products are archived (deactivated), never hard-deleted, so past sales stay intact. */
  async archive(id: string, storeId: string): Promise<Product> {
    const product = await this.findOne(id, storeId);
    product.isActive = false;
    return this.productRepository.save(product);
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

  private async assertBarcodeFree(storeId: string, barcode: string) {
    const clash = await this.productRepository.findOne({ where: { storeId, barcode } });
    if (clash) throw new ConflictException(`A product with barcode ${barcode} already exists in this store`);
  }
}
