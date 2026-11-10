import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, EntityManager, Repository } from 'typeorm';
import { Promotion, PromotionScope, PromotionType } from '../infrastructure/database/entities/promotion.entity';
import { Product } from '../infrastructure/database/entities/product.entity';
import { CreatePromotionDto, ListPromotionsQueryDto, UpdatePromotionDto } from './dto/promotion.dto';

@Injectable()
export class PromotionsService {
  constructor(
    @InjectRepository(Promotion) private readonly repo: Repository<Promotion>,
    @InjectRepository(Product) private readonly products: Repository<Product>,
  ) {}

  /** Offers running right now for a store. The sale uses this same query, so the till and the server agree. */
  static currentFor(manager: EntityManager, storeId: string): Promise<Promotion[]> {
    const now = new Date();
    return manager
      .createQueryBuilder(Promotion, 'p')
      .where('p.storeId = :storeId AND p.isActive = true', { storeId })
      .andWhere(new Brackets((q) => q.where('p.startsAt IS NULL').orWhere('p.startsAt <= :now', { now })))
      .andWhere(new Brackets((q) => q.where('p.endsAt IS NULL').orWhere('p.endsAt >= :now', { now })))
      .getMany();
  }

  async list(storeId: string, q: ListPromotionsQueryDto) {
    if (q.current === 'true') return PromotionsService.currentFor(this.repo.manager, storeId);
    return this.repo.find({ where: { storeId }, order: { createdAt: 'DESC' } });
  }

  private async check(storeId: string, d: Partial<CreatePromotionDto>) {
    if (d.startsAt && d.endsAt && new Date(d.endsAt) < new Date(d.startsAt)) throw new BadRequestException('The end date must be after the start date');
    if (d.scope === PromotionScope.PRODUCT && d.productId) {
      const p = await this.products.findOne({ where: { id: d.productId, storeId } });
      if (!p) throw new BadRequestException('Product does not exist in this store');
      if (d.type === PromotionType.MULTIBUY && p.unitType !== 'each') throw new BadRequestException('Multibuy offers are for counted items, not weighed ones');
      if (d.type === PromotionType.MULTIBUY && d.bundlePrice !== undefined && d.buyQty && d.bundlePrice >= p.price * d.buyQty) {
        throw new BadRequestException(`That bundle costs ${(p.price * d.buyQty).toFixed(2)} at shelf price, so it would not be a saving`);
      }
    }
  }

  async create(storeId: string, dto: CreatePromotionDto): Promise<Promotion> {
    await this.check(storeId, dto);
    const isPct = dto.type === PromotionType.PERCENT_OFF;
    return this.repo.save(
      this.repo.create({
        storeId,
        name: dto.name.trim(),
        type: dto.type,
        scope: dto.scope,
        productId: dto.scope === PromotionScope.PRODUCT ? dto.productId! : null,
        department: dto.scope === PromotionScope.DEPARTMENT ? dto.department!.trim() : null,
        percentOff: isPct ? dto.percentOff! : null,
        buyQty: isPct ? null : dto.buyQty!,
        bundlePrice: isPct ? null : dto.bundlePrice!,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
        isActive: dto.isActive ?? true,
      }),
    );
  }

  async update(id: string, storeId: string, dto: UpdatePromotionDto): Promise<Promotion> {
    const promo = await this.repo.findOne({ where: { id, storeId } });
    if (!promo) throw new NotFoundException('Promotion not found');
    // validate the merged result so a partial edit cannot leave an invalid offer
    const merged = { ...promo, ...dto, startsAt: dto.startsAt ?? promo.startsAt?.toISOString(), endsAt: dto.endsAt ?? promo.endsAt?.toISOString() } as any;
    await this.check(storeId, merged);
    if (dto.name !== undefined) promo.name = dto.name.trim();
    if (dto.percentOff !== undefined) promo.percentOff = dto.percentOff;
    if (dto.buyQty !== undefined) promo.buyQty = dto.buyQty;
    if (dto.bundlePrice !== undefined) promo.bundlePrice = dto.bundlePrice;
    if (dto.startsAt !== undefined) promo.startsAt = dto.startsAt ? new Date(dto.startsAt) : null;
    if (dto.endsAt !== undefined) promo.endsAt = dto.endsAt ? new Date(dto.endsAt) : null;
    if (dto.isActive !== undefined) promo.isActive = dto.isActive;
    return this.repo.save(promo);
  }
}
