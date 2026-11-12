import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserRole, UserStatus } from '../infrastructure/database/entities';
import { PermissionsService } from '../permissions/permissions.service';
import { PermissionKey, permissionLabel } from '../permissions/permissions';
import { AuditLogService } from '../audit-log/audit-log.service';

export const APPROVER_ROLES = [UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN, UserRole.MANAGER];
const TOKEN_PURPOSE = 'till-approval';
const TOKEN_TTL = '5m';
const MAX_FAILURES = 5;
const LOCK_MS = 5 * 60 * 1000;

export interface Approval {
  approverId: string;
  approverName: string;
}

/** The person asking, as the controllers pass it. */
export interface Requester {
  id: string;
  name?: string;
  role?: UserRole | string;
  tenantId?: string | null;
}

const NEEDS_APPROVAL: Record<PermissionKey, string> = {
  discounts: 'Manager approval is required for discounts and price overrides',
  refunds: 'Manager approval is required for a refund',
  paidOut: 'Manager approval is required for a paid out',
  noSale: 'Manager approval is required to open the drawer',
} as Record<PermissionKey, string>;

/**
 * Manager approval for sensitive till actions (discounts, price overrides).
 * A manager enters their PIN on the till; if it matches they get a short-lived
 * token for this store, which the sale request then carries. The cashier never
 * sees the PIN and the token cannot be used in another store.
 */
@Injectable()
export class ApprovalsService {
  /** Failed PIN attempts per requesting user (in memory: resets on restart, good enough to stop guessing). */
  private failures = new Map<string, { count: number; lockedUntil: number }>();

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly jwt: JwtService,
    private readonly permissions: PermissionsService,
    private readonly audit: AuditLogService,
  ) {}

  /**
   * May this person do a till action? Uses the company's permissions:
   * allowed → they approve it themselves; needs PIN → the approval token from a manager's PIN; not allowed → refused.
   * Returns who approved (recorded on the sale, refund or drawer movement).
   */
  async authorise(storeId: string, user: Requester, key: PermissionKey, approvalToken?: string): Promise<Approval> {
    const level = await this.permissions.level({ role: user.role, tenantId: user.tenantId }, key);
    if (level === 'yes') return { approverId: user.id, approverName: user.name ?? '' };
    if (level === 'no') throw new ForbiddenException(`Your role is not allowed to do this: ${permissionLabel(key).toLowerCase()}`);
    if (!approvalToken) throw new ForbiddenException(NEEDS_APPROVAL[key] ?? 'Manager approval is required');
    return this.verifyToken(approvalToken, storeId, key);
  }

  async setPin(userId: string, pin: string): Promise<{ message: string }> {
    const me = await this.users.findOne({ where: { id: userId } });
    if (!me || !APPROVER_ROLES.includes(me.role)) throw new ForbiddenException('Only managers and admins have an approval PIN');
    await this.assertPinFree(me, pin);
    await this.users.update(me.id, { pinHash: await bcrypt.hash(pin, 10) });
    await this.audit.record({ actor: me, storeId: me.restaurantId ?? null, action: 'staff.approval_pin', entityType: 'user', entityId: me.id, summary: `${me.name} changed their manager approval PIN` });
    return { message: 'PIN saved' };
  }

  /** Two approvers sharing a PIN would make "who approved" ambiguous, so approver PINs are unique within a store. */
  private async assertPinFree(user: User, pin: string) {
    if (!APPROVER_ROLES.includes(user.role)) return;
    for (const o of await this.approvers(user.restaurantId, user.tenantId)) {
      if (o.id !== user.id && (await bcrypt.compare(pin, o.pinHash!))) throw new BadRequestException('That PIN is already in use, choose another');
    }
  }

  /**
   * Gives a member of staff the employee number and PIN they use to sign in at the till.
   * Managers can do it for cashiers of their own store; company admins for anyone in the company.
   */
  async setStaffCredentials(actor: { id: string; role: UserRole; tenantId?: string; restaurantId?: string }, userId: string, dto: { employeeNumber?: string; pin?: string }) {
    const target = await this.users.createQueryBuilder('u').addSelect('u.pinHash').where('u.id = :userId', { userId }).getOne();
    if (!target || target.role === UserRole.SUPER_ADMIN || (actor.tenantId && target.tenantId !== actor.tenantId)) throw new NotFoundException('Staff member not found');
    if (actor.role === UserRole.MANAGER && (target.role !== UserRole.CASHIER || target.restaurantId !== actor.restaurantId)) {
      throw new ForbiddenException('Managers can set PINs for cashiers in their own store');
    }
    if (dto.employeeNumber !== undefined) {
      const clash = await this.users.findOne({ where: { tenantId: target.tenantId, employeeNumber: dto.employeeNumber } });
      if (clash && clash.id !== target.id) throw new BadRequestException('That employee number is already in use');
      target.employeeNumber = dto.employeeNumber;
    }
    if (dto.pin !== undefined) {
      await this.assertPinFree(target, dto.pin);
      target.pinHash = await bcrypt.hash(dto.pin, 10);
    }
    if (!target.employeeNumber && target.pinHash) throw new BadRequestException('Give this person an employee number too');
    await this.users.save(target);
    const changed = [dto.employeeNumber !== undefined && `employee number ${target.employeeNumber}`, dto.pin !== undefined && 'till PIN'].filter(Boolean).join(' and ');
    await this.audit.record({
      actor: { id: actor.id, role: actor.role, tenantId: actor.tenantId },
      storeId: target.restaurantId ?? null,
      action: 'staff.till_login',
      entityType: 'user',
      entityId: target.id,
      summary: `Set ${changed || 'till sign-in'} for ${target.name}`,
    });
    return { id: target.id, name: target.name, employeeNumber: target.employeeNumber, hasPin: !!target.pinHash };
  }

  async verifyPin(storeId: string, requester: { id: string; name?: string; role?: string; tenantId?: string }, pin: string) {
    const f = this.failures.get(requester.id);
    if (f && f.lockedUntil > Date.now()) {
      throw new ForbiddenException('Too many wrong PIN attempts. Try again in a few minutes.');
    }

    const candidates = await this.approvers(storeId, requester.tenantId);
    let approver: User | undefined;
    for (const c of candidates) {
      if (await bcrypt.compare(pin, c.pinHash!)) {
        approver = c;
        break;
      }
    }

    if (!approver) {
      const count = (f && f.lockedUntil <= Date.now() ? f.count : 0) + 1;
      this.failures.set(requester.id, { count, lockedUntil: count >= MAX_FAILURES ? Date.now() + LOCK_MS : 0 });
      await this.audit.record({
        actor: requester,
        storeId,
        action: 'auth.manager_pin_failed',
        summary: count >= MAX_FAILURES ? `Wrong manager PIN entered ${count} times; PIN entry locked for 5 minutes` : 'Wrong manager PIN entered',
        details: { attempts: count },
      });
      // 403, not 401: the app treats 401 as an expired login and would sign the cashier out
      throw new ForbiddenException('Incorrect manager PIN');
    }
    this.failures.delete(requester.id);

    const approvalToken = this.jwt.sign(
      { purpose: TOKEN_PURPOSE, sub: approver.id, name: approver.name, storeId },
      { expiresIn: TOKEN_TTL },
    );
    return { approvalToken, approver: { id: approver.id, name: approver.name }, expiresInSeconds: 300 };
  }

  /**
   * Checks a token from the till and returns who approved. Throws when invalid, expired or for another store,
   * or when the approver's own role isn't allowed to do `key`.
   */
  async verifyToken(token: string, storeId: string, key?: PermissionKey): Promise<Approval> {
    let payload: any;
    try {
      payload = this.jwt.verify(token);
    } catch {
      throw new ForbiddenException('Manager approval has expired. Ask the manager to approve again.');
    }
    if (payload?.purpose !== TOKEN_PURPOSE || payload.storeId !== storeId) {
      throw new ForbiddenException('Manager approval is not valid for this store');
    }
    const approver = await this.users.findOne({ where: { id: payload.sub } });
    if (!approver || approver.status !== UserStatus.ACTIVE || !APPROVER_ROLES.includes(approver.role)) {
      throw new ForbiddenException('The approving manager is no longer active');
    }
    if (key && (await this.permissions.level(approver, key)) !== 'yes') {
      throw new ForbiddenException(`${approver.name} is not allowed to approve this: ${permissionLabel(key).toLowerCase()}`);
    }
    return { approverId: approver.id, approverName: approver.name };
  }

  /** Active managers/admins who can approve in a store and have set a PIN. */
  private async approvers(storeId: string | null | undefined, tenantId: string | null | undefined): Promise<User[]> {
    const qb = this.users
      .createQueryBuilder('u')
      .addSelect('u.pinHash')
      .where('u.status = :active', { active: UserStatus.ACTIVE })
      .andWhere('u.pinHash IS NOT NULL')
      .andWhere('u.role IN (:...roles)', { roles: APPROVER_ROLES });
    const scope: string[] = ["u.role = 'super_admin'"];
    const params: Record<string, string> = {};
    if (storeId) {
      scope.push('(u.role = \'manager\' AND u.restaurantId = :storeId)');
      params.storeId = storeId;
    }
    if (tenantId) {
      scope.push("(u.role = 'tenant_admin' AND u.tenantId = :tenantId)");
      params.tenantId = tenantId;
    }
    return qb.andWhere(`(${scope.join(' OR ')})`, params).getMany();
  }
}
