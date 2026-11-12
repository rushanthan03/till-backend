import { Controller, Get, Headers, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../infrastructure/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../infrastructure/auth/guards/roles.guard';
import { Roles } from '../infrastructure/auth/decorators/roles.decorator';
import { CurrentUser } from '../infrastructure/auth/decorators/current-user.decorator';
import { UserRole } from '../infrastructure/database/entities';
import { NeedsPermission } from '../permissions/permissions.decorator';
import { companyOf } from '../permissions/permissions.controller';
import { AUDIT_GROUPS, AuditLogService } from './audit-log.service';
import { ListAuditQueryDto } from './audit-log.dto';

const VIEWERS = [UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN, UserRole.MANAGER];

/** Read-only: entries can't be changed or deleted through the API. Managers see only their own store. */
@ApiTags('Audit log')
@Controller('audit-log')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...VIEWERS)
@NeedsPermission('audit')
export class AuditLogController {
  constructor(private readonly audit: AuditLogService) {}

  @Get()
  @ApiOperation({ summary: 'Audit log entries, newest first' })
  list(@Query() q: ListAuditQueryDto, @CurrentUser() user: any, @Headers('x-tenant-id') tenant?: string) {
    return this.audit.list(companyOf(user, tenant), q, this.ownStore(user));
  }

  @Get('filters')
  @ApiOperation({ summary: 'Action groups and people for the filters' })
  async filters(@CurrentUser() user: any, @Headers('x-tenant-id') tenant?: string) {
    return { groups: AUDIT_GROUPS, people: await this.audit.people(companyOf(user, tenant), this.ownStore(user)) };
  }

  private ownStore(user: any): string | undefined {
    // A manager without a store sees nothing rather than everything.
    return user.role === UserRole.MANAGER ? user.restaurantId || '00000000-0000-0000-0000-000000000000' : undefined;
  }
}
