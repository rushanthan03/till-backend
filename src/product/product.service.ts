import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, FindOptionsWhere, Brackets } from 'typeorm';
import { Product } from '../infrastructure/database/entities/product.entity';
import { CreateProductDto, UpdateProductDto, ListProductsQueryDto } from './dto/product.dto';
import { buildSeedRows } from './product.seed';

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  async findAll(restaurantId: string, query: ListProductsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;

    const qb = this.productRepository
      .createQueryBuilder('p')
      .where('p.restaurantId = :restaurantId', { restaurantId });

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

  async findOne(id: string, restaurantId: string): Promise<Product> {
    const product = await this.productRepository.findOne({ where: { id, restaurantId } });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  /** Till lookup: exact barcode match (or SKU) among active products. */
  async findByBarcode(barcode: string, restaurantId: string): Promise<Product> {
    const where: FindOptionsWhere<Product>[] = [
      { restaurantId, barcode, isActive: true },
      { restaurantId, sku: barcode, isActive: true },
    ];
    const product = await this.productRepository.findOne({ where });
    if (!product) throw new NotFoundException(`No active product found for barcode ${barcode}`);
    return product;
  }

  async listDepartments(restaurantId: string): Promise<{ department: string; count: number }[]> {
    const rows = await this.productRepository
      .createQueryBuilder('p')
      .select('p.department', 'department')
      .addSelect('COUNT(*)', 'count')
      .where('p.restaurantId = :restaurantId', { restaurantId })
      .groupBy('p.department')
      .orderBy('p.department', 'ASC')
      .getRawMany();
    return rows.map((r) => ({ department: r.department, count: Number(r.count) }));
  }

  async create(restaurantId: string, dto: CreateProductDto): Promise<Product> {
    await this.assertBarcodeFree(restaurantId, dto.barcode);
    const product = this.productRepository.create({
      ...dto,
      restaurantId,
      sku: dto.sku ?? null,
      category: dto.category ?? null,
      brand: dto.brand ?? null,
      costPrice: dto.costPrice ?? null,
      imageUrl: dto.imageUrl ?? null,
    });
    return this.productRepository.save(product);
  }

  async update(id: string, restaurantId: string, dto: UpdateProductDto): Promise<Product> {
    const product = await this.findOne(id, restaurantId);
    if (dto.barcode && dto.barcode !== product.barcode) {
      await this.assertBarcodeFree(restaurantId, dto.barcode);
    }
    Object.assign(product, dto);
    return this.productRepository.save(product);
  }

  /** Products are archived (deactivated), never hard-deleted, so past sales stay intact. */
  async archive(id: string, restaurantId: string): Promise<Product> {
    const product = await this.findOne(id, restaurantId);
    product.isActive = false;
    return this.productRepository.save(product);
  }

  /** Loads the demo catalogue; products whose barcode already exists are skipped. */
  async seedDemoProducts(restaurantId: string): Promise<{ created: number; skipped: number }> {
    const rows = buildSeedRows(restaurantId);
    const existing = await this.productRepository.find({ where: { restaurantId }, select: ['barcode'] });
    const taken = new Set(existing.map((e) => e.barcode));
    const toCreate = rows.filter((r) => !taken.has(r.barcode));
    if (toCreate.length) {
      await this.productRepository.save(toCreate.map((r) => this.productRepository.create(r)));
    }
    return { created: toCreate.length, skipped: rows.length - toCreate.length };
  }

  private async assertBarcodeFree(restaurantId: string, barcode: string) {
    const clash = await this.productRepository.findOne({ where: { restaurantId, barcode } });
    if (clash) throw new ConflictException(`A product with barcode ${barcode} already exists in this store`);
  }
}
