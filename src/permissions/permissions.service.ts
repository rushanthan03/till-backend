import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../infrastructure/database/entities';
import { AuditActor, AuditLogService } from '../audit-log/audit-log.service';
import {
  LEVEL_WORDS,
  Level,
  PERMISSIONS,
  PermissionKey,
  RolePermissions,
  applyUpdate,
  defaultPermissions,
  diffPermissions,
  levelFor,
  levelsFor,
  mergePermissions,
} from './permissions';

const CACHE_MS = 30_000;

export interface PermissionUser {
  role?: string;
  tenantId?: string | null;
}

/** Company-wide role permissions, kept in the tenant's settings under `rolePermissions`. */
@Injectable()
export class PermissionsService {
  private cache = new Map<string, { perms: RolePermissions; at: number }>();

  constructor(
    @InjectRepository(Tenant) private readonly tenants: Repository<Tenant>,
    private readonly audit: AuditLogService,
  ) {}

  async forTenant(tenantId: string | null | undefined): Promise<RolePermissions> {
    if (!tenantId) return defaultPermissions();
    const hit = this.cache.get(tenantId);
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.perms;
    const t = await this.tenants.findOne({ where: { id: tenantId }, select: ['id', 'settings'] });
    const perms = mergePermissions(t?.settings?.rolePermissions);
    this.cache.set(tenantId, { perms, at: Date.now() });
    return perms;
  }

  async level(user: PermissionUser, key: PermissionKey): Promise<Level> {
    const role = (user.role ?? '').toLowerCase();
    if (role === 'super_admin' || role === 'tenant_admin') return 'yes';
    return levelFor(await this.forTenant(user.tenantId), role, key);
  }

  /** What the signed-in user may do; the app uses it to show menus and till buttons. */
  async mine(user: PermissionUser) {
    return { role: user.role, levels: levelsFor(await this.forTenant(user.tenantId), user.role) };
  }

  async settings(tenantId: string) {
    return { permissions: PERMISSIONS, roles: await this.forTenant(tenantId), defaults: defaultPermissions() };
  }

  async update(tenantId: string, input: unknown, actor: AuditActor) {
    const tenant = await this.tenants.findOne({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Company not found');
    const before = mergePermissions(tenant.settings?.rolePermissions);
    const { value, error } = applyUpdate(before, input);
    if (error || !value) throw new BadRequestException(error);
    const changes = diffPermissions(before, value);
    if (changes.length) {
      tenant.settings = { ...(tenant.settings ?? {}), rolePermissions: value };
      await this.tenants.save(tenant);
      this.cache.delete(tenantId);
      await this.audit.record({
        actor,
        tenantId,
        action: 'permissions.update',
        entityType: 'permissions',
        summary: changes.map((c) => `${c.role === 'manager' ? 'Managers' : 'Cashiers'}: ${c.label} ${LEVEL_WORDS[c.from]} → ${LEVEL_WORDS[c.to]}`).join('; '),
        details: { changes },
      });
    }
    return { permissions: PERMISSIONS, roles: value, defaults: defaultPermissions(), changed: changes.length };
  }
}
