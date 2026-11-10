import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomInt } from 'crypto';
import { Customer } from '../infrastructure/database/entities/customer.entity';
import { Sale } from '../infrastructure/database/entities/sale.entity';
import { CreateCustomerDto, ListCustomersQueryDto, UpdateCustomerDto } from './dto/customer.dto';

/** 1 point per whole £1 paid. */
export const pointsForTotal = (total: number): number => Math.max(0, Math.floor(total));

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer) private readonly repo: Repository<Customer>,
    @InjectRepository(Sale) private readonly sales: Repository<Sale>,
  ) {}

  async list(storeId: string, q: ListCustomersQueryDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 25;
    const qb = this.repo.createQueryBuilder('c').where('c.storeId = :storeId AND c.isActive = true', { storeId });
    const s = q.search?.trim();
    if (s) qb.andWhere('(c.name ILIKE :s OR c.phone ILIKE :s OR c.email ILIKE :s OR c.cardNumber ILIKE :s)', { s: `%${s}%` });
    const [data, total] = await qb.orderBy('c.createdAt', 'DESC').skip((page - 1) * limit).take(limit).getManyAndCount();
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /** A customer with their latest purchases. */
  async findOne(id: string, storeId: string) {
    const customer = await this.repo.findOne({ where: { id, storeId } });
    if (!customer) throw new NotFoundException('Customer not found');
    const recent = await this.sales.find({
      where: { customerId: id, storeId },
      select: ['id', 'receiptNumber', 'total', 'pointsEarned', 'status', 'createdAt'],
      order: { createdAt: 'DESC' },
      take: 10,
    });
    return { ...customer, recentSales: recent };
  }

  async create(storeId: string, dto: CreateCustomerDto): Promise<Customer> {
    const phone = dto.phone?.trim() || null;
    if (phone && (await this.repo.findOne({ where: { storeId, phone, isActive: true } }))) {
      throw new ConflictException('A customer with that phone number already exists');
    }
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.repo.save(
          this.repo.create({
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
    const c = await this.repo.findOne({ where: { id, storeId } });
    if (!c) throw new NotFoundException('Customer not found');
    if (dto.phone !== undefined && dto.phone?.trim() !== (c.phone ?? '')) {
      const phone = dto.phone?.trim() || null;
      if (phone && (await this.repo.findOne({ where: { storeId, phone, isActive: true } }))) throw new ConflictException('A customer with that phone number already exists');
      c.phone = phone;
    }
    if (dto.name !== undefined) c.name = dto.name.trim();
    if (dto.email !== undefined) c.email = dto.email?.trim().toLowerCase() || null;
    if (dto.marketingConsent !== undefined) c.marketingConsent = dto.marketingConsent;
    if (dto.isActive !== undefined) c.isActive = dto.isActive;
    return this.repo.save(c);
  }
}
