import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomInt } from 'crypto';
import { Customer } from '../infrastructure/database/entities/customer.entity';
import { Restaurant } from '../infrastructure/database/entities/restaurant.entity';
import { Sale } from '../infrastructure/database/entities/sale.entity';
import { CreateCustomerDto, ListCustomersQueryDto, UpdateCustomerDto } from './dto/customer.dto';

/** 1 point per whole £1 paid. */
export const pointsForTotal = (total: number): number => Math.max(0, Math.floor(total));

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer) private readonly repo: Repository<Customer>,
    @InjectRepository(Sale) private readonly sales: Repository<Sale>,
    @InjectRepository(Restaurant) private readonly stores: Repository<Restaurant>,
  ) {}

  /** Customers belong to the company that owns the store, so every store of that company sees the same members. */
  private async tenantOf(storeId: string): Promise<string> {
    const store = await this.stores.findOne({ where: { id: storeId }, select: ['id', 'tenantId'] });
    if (!store?.tenantId) throw new NotFoundException('Store not found');
    return store.tenantId;
  }

  async list(storeId: string, q: ListCustomersQueryDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 25;
    const tenantId = await this.tenantOf(storeId);
    const qb = this.repo.createQueryBuilder('c').where('c.tenantId = :tenantId AND c.isActive = true', { tenantId });
    const s = q.search?.trim();
    if (s) qb.andWhere('(c.name ILIKE :s OR c.phone ILIKE :s OR c.email ILIKE :s OR c.cardNumber ILIKE :s)', { s: `%${s}%` });
    const [data, total] = await qb.orderBy('c.createdAt', 'DESC').skip((page - 1) * limit).take(limit).getManyAndCount();
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /** A customer with their latest purchases. */
  async findOne(id: string, storeId: string) {
    const customer = await this.repo.findOne({ where: { id, tenantId: await this.tenantOf(storeId) } });
    if (!customer) throw new NotFoundException('Customer not found');
    // purchases in any store of the company, newest first, with the store they were made in
    const recent = await this.sales
      .createQueryBuilder('s')
      .leftJoin(Restaurant, 'st', 'st.id = s.storeId')
      .select(['s.id', 's.receiptNumber', 's.total', 's.pointsEarned', 's.status', 's.createdAt'])
      .addSelect('st.name', 'storeName')
      .where('s.customerId = :id', { id })
      .orderBy('s.createdAt', 'DESC')
      .limit(10)
      .getRawAndEntities();
    const recentSales = recent.entities.map((e, i) => ({ ...e, storeName: recent.raw[i]?.storeName ?? null }));
    const homeStore = await this.stores.findOne({ where: { id: customer.storeId }, select: ['id', 'name'] });
    return { ...customer, homeStoreName: homeStore?.name ?? null, recentSales };
  }

  async create(storeId: string, dto: CreateCustomerDto): Promise<Customer> {
    const tenantId = await this.tenantOf(storeId);
    const phone = dto.phone?.trim() || null;
    if (phone && (await this.repo.findOne({ where: { tenantId, phone, isActive: true } }))) {
      throw new ConflictException('A customer with that phone number already exists');
    }
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.repo.save(
          this.repo.create({
            tenantId,
            storeId,
            cardNumber: `C${randomInt(10000000, 99999999)}`,
            name: dto.name.trim(),
            phone,
            email: dto.email?.trim().toLowerCase() || null,
            marketingConsent: dto.marketingConsent ?? false,
          }),
        );
      } catch (e: any) {
        if (e?.code === '23505' && attempt < 5) continue; // card number clash: pick another
        throw e;
      }
    }
  }

  async update(id: string, storeId: string, dto: UpdateCustomerDto): Promise<Customer> {
    const tenantId = await this.tenantOf(storeId);
    const c = await this.repo.findOne({ where: { id, tenantId } });
    if (!c) throw new NotFoundException('Customer not found');
    if (dto.phone !== undefined && dto.phone?.trim() !== (c.phone ?? '')) {
      const phone = dto.phone?.trim() || null;
      if (phone && (await this.repo.findOne({ where: { tenantId, phone, isActive: true } }))) throw new ConflictException('A customer with that phone number already exists');
      c.phone = phone;
    }
    if (dto.name !== undefined) c.name = dto.name.trim();
    if (dto.email !== undefined) c.email = dto.email?.trim().toLowerCase() || null;
    if (dto.marketingConsent !== undefined) c.marketingConsent = dto.marketingConsent;
    if (dto.isActive !== undefined) c.isActive = dto.isActive;
    return this.repo.save(c);
  }

  /** Everything held about a customer, to hand over when they ask for their data (UK GDPR subject access). */
  async exportData(id: string, storeId: string) {
    const customer = await this.repo.findOne({ where: { id, tenantId: await this.tenantOf(storeId) } });
    if (!customer) throw new NotFoundException('Customer not found');
    const purchases = await this.sales.find({
      where: { customerId: id },
      select: ['receiptNumber', 'total', 'pointsEarned', 'status', 'createdAt'],
      order: { createdAt: 'ASC' },
    });
    return {
      exportedAt: new Date().toISOString(),
      customer: {
        name: customer.name, phone: customer.phone, email: customer.email, cardNumber: customer.cardNumber,
        marketingConsent: customer.marketingConsent, pointsBalance: customer.pointsBalance, totalSpend: customer.totalSpend,
        visitCount: customer.visitCount, lastVisitAt: customer.lastVisitAt, joinedAt: customer.createdAt,
      },
      purchases,
    };
  }

  /**
   * Right to erasure: removes the personal details and switches marketing off. Sales stay (the shop must keep
   * its accounts) but no longer name the customer. This cannot be undone.
   */
  async erase(id: string, storeId: string) {
    const c = await this.repo.findOne({ where: { id, tenantId: await this.tenantOf(storeId) } });
    if (!c) throw new NotFoundException('Customer not found');
    await this.sales.update({ customerId: id }, { customerName: null });
    Object.assign(c, { name: 'Erased customer', phone: null, email: null, marketingConsent: false, isActive: false, pointsBalance: 0 });
    await this.repo.save(c);
    return { id, erased: true };
  }
}
