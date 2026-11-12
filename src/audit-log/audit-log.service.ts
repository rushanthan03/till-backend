import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../infrastructure/database/entities/audit-log.entity';
import { Restaurant, User } from '../infrastructure/database/entities';
import { ListAuditQueryDto } from './audit-log.dto';

/** Whoever did it. Services often only know id and name; the rest is looked up. */
export interface AuditActor {
  id?: string | null;
  name?: string | null;
  role?: string | null;
  tenantId?: string | null;
}

export interface AuditEntry {
  actor?: AuditActor | null;
  tenantId?: string | null;
  storeId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string | null;
  summary: string;
  details?: Record<string, unknown>;
}

/** Action groups for the filter on the audit page; an action belongs to a group by its prefix. */
export const AUDIT_GROUPS: Record<string, string> = {
  auth: 'Sign-ins',
  sale: 'Sales and price changes',
  refund: 'Refunds',
  drawer: 'Cash drawer',
  shift: 'Till sessions',
  product: 'Products',
  stock: 'Stock',
  purchasing: 'Purchasing',
  promotion: 'Promotions',
  customer: 'Customers',
  staff: 'Staff',
  permissions: 'Permissions',
  settings: 'Settings',
};

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);
  private storeTenant = new Map<string, string>();

  constructor(
    @InjectRepository(AuditLog) private readonly logs: Repository<AuditLog>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Restaurant) private readonly stores: Repository<Restaurant>,
  ) {}

  /** Writes one entry. Never throws: a failed audit write must not undo a sale or refund. */
  async record(e: AuditEntry): Promise<void> {
    try {
      const actor = { ...(e.actor ?? {}) };
      if (actor.id && (!actor.role || actor.tenantId === undefined || !actor.name)) {
        const u = await this.users.findOne({ where: { id: actor.id }, select: ['id', 'name', 'role', 'tenantId'] });
        if (u) {
          actor.name ??= u.name;
          actor.role ??= u.role;
          if (actor.tenantId === undefined) actor.tenantId = u.tenantId;
        }
      }
      const tenantId = e.tenantId ?? (e.storeId ? await this.tenantOfStore(e.storeId) : null) ?? actor.tenantId ?? null;
      await this.logs.insert({
        tenantId,
        storeId: e.storeId ?? null,
        userId: actor.id ?? null,
        userName: actor.name?.slice(0, 150) ?? null,
        userRole: actor.role ?? null,
        action: e.action,
        entityType: e.entityType ?? null,
        entityId: e.entityId ? String(e.entityId).slice(0, 80) : null,
        summary: e.summary.slice(0, 500),
        details: e.details ?? null,
      });
    } catch (err) {
      this.logger.error(`Could not write audit entry ${e.action}: ${(err as Error).message}`);
    }
  }

  private async tenantOfStore(storeId: string): Promise<string | null> {
    const cached = this.storeTenant.get(storeId);
    if (cached) return cached;
    const s = await this.stores.findOne({ where: { id: storeId }, select: ['id', 'tenantId'] });
    if (s?.tenantId) this.storeTenant.set(storeId, s.tenantId);
    return s?.tenantId ?? null;
  }

  /** Newest first. `storeOnly` limits a manager to their own store's entries. */
  async list(tenantId: string, q: ListAuditQueryDto, storeOnly?: string) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 50;
    const qb = this.logs.createQueryBuilder('a').where('a.tenantId = :tenantId', { tenantId });
    const storeId = storeOnly ?? q.storeId;
    if (storeId) qb.andWhere('a.storeId = :storeId', { storeId });
    if (q.userId) qb.andWhere('a.userId = :userId', { userId: q.userId });
    if (q.group && AUDIT_GROUPS[q.group]) qb.andWhere('(a.action = :g OR a.action LIKE :gp)', { g: q.group, gp: `${q.group}.%` });
    if (q.search?.trim()) qb.andWhere('(a.summary ILIKE :s OR a.userName ILIKE :s)', { s: `%${q.search.trim()}%` });
    if (q.from) qb.andWhere('a.createdAt >= :from', { from: new Date(q.from) });
    if (q.to) qb.andWhere('a.createdAt <= :to', { to: new Date(q.to) });
    const [data, total] = await qb.orderBy('a.createdAt', 'DESC').addOrderBy('a.id', 'DESC').skip((page - 1) * limit).take(limit).getManyAndCount();
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /** People who appear in the log, for the "who" filter. */
  async people(tenantId: string, storeOnly?: string) {
    const qb = this.logs
      .createQueryBuilder('a')
      .select('a.userId', 'id')
      .addSelect('MAX(a.userName)', 'name')
      .where('a.tenantId = :tenantId AND a.userId IS NOT NULL', { tenantId });
    if (storeOnly) qb.andWhere('a.storeId = :storeOnly', { storeOnly });
    return qb.groupBy('a.userId').orderBy('name').getRawMany<{ id: string; name: string }>();
  }
}
