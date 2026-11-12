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
  static currentFor(manager: EntityManager, storeId: string, at: Date = new Date()): Promise<Promotion[]> {
    const now = at;
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

  /**
   * Turns a full offer description into the stored fields, clearing whatever the type or scope does not use,
   * and checks it makes sense for the store's products.
   */
  private async build(storeId: string, d: Partial<CreatePromotionDto>) {
    if (!d.name?.trim()) throw new BadRequestException('Give the offer a name');
    const type = d.type;
    const scope = d.scope;
    if (!type || !Object.values(PromotionType).includes(type)) throw new BadRequestException('Choose the kind of offer');
    if (!scope || !Object.values(PromotionScope).includes(scope)) throw new BadRequestException('Choose what the offer applies to');
    if (scope === PromotionScope.PRODUCT && !d.productId) throw new BadRequestException('Choose a product');
    if (scope === PromotionScope.DEPARTMENT && !d.department?.trim()) throw new BadRequestException('Choose a department');
    if (type === PromotionType.MULTIBUY && scope !== PromotionScope.PRODUCT) throw new BadRequestException('Multibuy offers are for one product');
    if (type === PromotionType.PERCENT_OFF && !(Number(d.percentOff) > 0 && Number(d.percentOff) <= 100)) throw new BadRequestException('Enter a percentage between 1 and 100');
    if (type === PromotionType.MULTIBUY && !(Number(d.buyQty) >= 2)) throw new BadRequestException('A multibuy needs at least 2 items');
    if (type === PromotionType.MULTIBUY && !(d.bundlePrice !== undefined && d.bundlePrice !== null && Number(d.bundlePrice) >= 0)) throw new BadRequestException('Enter the bundle price');
    if (type === PromotionType.BUY_GET_FREE && !(Number(d.buyQty) >= 1 && Number(d.freeQty) >= 1)) throw new BadRequestException('Enter how many to buy and how many are free');
    const startsAt = d.startsAt ? new Date(d.startsAt) : null;
    const endsAt = d.endsAt ? new Date(d.endsAt) : null;
    if (startsAt && endsAt && endsAt < startsAt) throw new BadRequestException('The end date must be after the start date');

    if (scope === PromotionScope.PRODUCT) {
      const p = await this.products.findOne({ where: { id: d.productId!, storeId } });
      if (!p) throw new BadRequestException('Product does not exist in this store');
      if (type !== PromotionType.PERCENT_OFF && p.unitType !== 'each') throw new BadRequestException('Multibuy and buy-get-free offers are for counted items, not weighed ones');
      if (type === PromotionType.MULTIBUY && Number(d.bundlePrice) >= p.price * Number(d.buyQty)) {
        throw new BadRequestException(`That bundle costs ${(p.price * Number(d.buyQty)).toFixed(2)} at shelf price, so it would not be a saving`);
      }
    }

    return {
      name: d.name.trim(),
      type,
      scope,
      productId: scope === PromotionScope.PRODUCT ? d.productId! : null,
      department: scope === PromotionScope.DEPARTMENT ? d.department!.trim() : null,
      percentOff: type === PromotionType.PERCENT_OFF ? Number(d.percentOff) : null,
      buyQty: type === PromotionType.PERCENT_OFF ? null : Number(d.buyQty),
      freeQty: type === PromotionType.BUY_GET_FREE ? Number(d.freeQty) : null,
      bundlePrice: type === PromotionType.MULTIBUY ? Number(d.bundlePrice) : null,
      startsAt,
      endsAt,
    };
  }

  async create(storeId: string, dto: CreatePromotionDto): Promise<Promotion> {
    const fields = await this.build(storeId, dto);
    return this.repo.save(this.repo.create({ storeId, ...fields, isActive: dto.isActive ?? true }));
  }

  /**
   * Edit any part of an offer. Fields left out keep their value; send null for startsAt/endsAt to clear a date.
   * Past sales are not affected: each sale line keeps the offer name and discount it was sold with.
   * Returns the saved offer and what it was before, for the audit log.
   */
  async update(id: string, storeId: string, dto: UpdatePromotionDto): Promise<{ promotion: Promotion; before: Promotion }> {
    const promo = await this.repo.findOne({ where: { id, storeId } });
    if (!promo) throw new NotFoundException('Promotion not found');
    const before = { ...promo };
    const onlyToggle = Object.keys(dto).every((k) => k === 'isActive');
    if (!onlyToggle) {
      const keep = <T>(v: T | undefined, current: T) => (v === undefined ? current : v);
      const merged: Partial<CreatePromotionDto> = {
        name: keep(dto.name, promo.name),
        type: keep(dto.type, promo.type),
        scope: keep(dto.scope, promo.scope),
        productId: keep(dto.productId, promo.productId ?? undefined),
        department: keep(dto.department, promo.department ?? undefined),
        percentOff: keep(dto.percentOff, promo.percentOff ?? undefined),
        buyQty: keep(dto.buyQty, promo.buyQty ?? undefined),
        freeQty: keep(dto.freeQty, promo.freeQty ?? undefined),
        bundlePrice: keep(dto.bundlePrice, promo.bundlePrice ?? undefined),
        startsAt: dto.startsAt === undefined ? promo.startsAt?.toISOString() : dto.startsAt || undefined,
        endsAt: dto.endsAt === undefined ? promo.endsAt?.toISOString() : dto.endsAt || undefined,
      };
      Object.assign(promo, await this.build(storeId, merged));
    }
    if (dto.isActive !== undefined) promo.isActive = dto.isActive;
    return { promotion: await this.repo.save(promo), before };
  }
}
