import { AuditLogService } from '../audit-log/audit-log.service';
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserManagementService } from './user-management.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from '../infrastructure/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../infrastructure/auth/guards/roles.guard';
import { TenantGuard } from '../infrastructure/auth/guards/tenant.guard';
import { Roles } from '../infrastructure/auth/decorators/roles.decorator';
import { CurrentUser } from '../infrastructure/auth/decorators/current-user.decorator';
import { UserRole } from '../infrastructure/database/entities';
import { User } from '../infrastructure/database/entities';
import { PaginationDto } from '../shared/dto/pagination.dto';
import { EnhancedPaginationDto } from '../shared/dto/enhanced-pagination.dto';

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly userManagementService: UserManagementService) { }

  @Get()
  @Roles(UserRole.SUPER_ADMIN)
  findAll(@Query() filters: EnhancedPaginationDto | PaginationDto) {
    // If any enhanced filter parameters are provided, use the enhanced endpoint
    if ((filters as EnhancedPaginationDto).search || (filters as EnhancedPaginationDto).sortBy || (filters as EnhancedPaginationDto).sortOrder || (filters as EnhancedPaginationDto).role || (filters as EnhancedPaginationDto).status || (filters as EnhancedPaginationDto).tenantId || (filters as EnhancedPaginationDto).restaurantId) {
      return this.userManagementService.findAllUsersWithFilters(filters as EnhancedPaginationDto);
    }
    // Otherwise, use the simple endpoint for backward compatibility
    return this.userManagementService.findAllUsers(filters as PaginationDto);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN)
  @ApiOperation({ summary: 'Delete or archive a user' })
  delete(
    @Param('id') id: string,
    @CurrentUser() currentUser: User,
  ) {
    return this.userManagementService.archive(id, currentUser);
  }
}

@ApiTags('Tenant Users')
@Controller('tenants/:tenantId/users')
@UseGuards(JwtAuthGuard, RolesGuard, TenantGuard)
export class TenantUsersController {
  constructor(
    private readonly userManagementService: UserManagementService,
    private readonly audit: AuditLogService,
  ) { }

  private log(actor: User, tenantId: string, action: string, target: { id: string; name: string; email?: string; restaurantId?: string | null }, summary: string, details?: Record<string, unknown>) {
    return this.audit.record({ actor, tenantId, storeId: target.restaurantId ?? null, action, entityType: 'user', entityId: target.id, summary, details });
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN)
  async create(@Param('tenantId') tenantId: string, @Body() createUserDto: CreateUserDto, @CurrentUser() currentUser: User) {
    const u = await this.userManagementService.create(tenantId, createUserDto);
    await this.log(currentUser, tenantId, 'staff.create', u, `Added ${u.name} (${u.email}) as ${roleWord(u.role)}`);
    return u;
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN)
  findAll(@Param('tenantId') tenantId: string, @Query() filters: EnhancedPaginationDto | PaginationDto) {
    // If any enhanced filter parameters are provided, use the enhanced endpoint
    if ((filters as EnhancedPaginationDto).search || (filters as EnhancedPaginationDto).sortBy || (filters as EnhancedPaginationDto).sortOrder || (filters as EnhancedPaginationDto).role || (filters as EnhancedPaginationDto).status || (filters as EnhancedPaginationDto).restaurantId) {
      return this.userManagementService.findAllWithFilters(tenantId, filters as EnhancedPaginationDto);
    }
    // Otherwise, use the simple endpoint for backward compatibility
    return this.userManagementService.findAll(tenantId, filters as PaginationDto);
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN)
  findOne(@Param('id') id: string) {
    return this.userManagementService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN)
  async update(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @CurrentUser() currentUser: User,
  ) {
    const before = await this.userManagementService.findOne(id);
    const after = await this.userManagementService.update(id, updateUserDto, currentUser);
    const changes: string[] = [];
    if (before.role !== after.role) changes.push(`role ${roleWord(before.role)} → ${roleWord(after.role)}`);
    if (before.status !== after.status) changes.push(`status ${before.status} → ${after.status}`);
    if (before.name !== after.name) changes.push(`name ${before.name} → ${after.name}`);
    if (before.email !== after.email) changes.push(`email ${before.email} → ${after.email}`);
    if ((before.restaurantId ?? null) !== (after.restaurantId ?? null)) changes.push('store changed');
    if ((updateUserDto as any).password) changes.push('password changed');
    if (changes.length) await this.log(currentUser, tenantId, after.role !== before.role ? 'staff.role' : 'staff.update', after, `${after.name}: ${changes.join(', ')}`);
    return after;
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN)
  @ApiOperation({ summary: 'Delete or archive a user under a tenant' })
  async delete(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @CurrentUser() currentUser: User,
  ) {
    const u = await this.userManagementService.archive(id, currentUser);
    await this.log(currentUser, tenantId, 'staff.archive', u, `Archived ${u.name} (${u.email})`);
    return u;
  }

  @Post(':id/archive')
  @Roles(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN)
  @ApiOperation({ summary: 'Archive a user under a tenant' })
  async archive(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @CurrentUser() currentUser: User,
  ) {
    const u = await this.userManagementService.archive(id, currentUser);
    await this.log(currentUser, tenantId, 'staff.archive', u, `Archived ${u.name} (${u.email})`);
    return u;
  }

  @Post(':id/unarchive')
  @Roles(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN)
  @ApiOperation({ summary: 'Unarchive a user under a tenant' })
  async unarchive(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @CurrentUser() currentUser: User,
  ) {
    const u = await this.userManagementService.unarchive(id, currentUser);
    await this.log(currentUser, tenantId, 'staff.unarchive', u, `Restored ${u.name} (${u.email})`);
    return u;
  }

  @Post(':id/reactivate')
  @Roles(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN)
  @ApiOperation({ summary: 'Reactivate a user under a tenant' })
  async reactivate(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @CurrentUser() currentUser: User,
  ) {
    const u = await this.userManagementService.reactivate(id, currentUser);
    await this.log(currentUser, tenantId, 'staff.reactivate', u, `Reactivated ${u.name} (${u.email})`);
    return u;
  }

  @Post(':id/reset-password')
  @Roles(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Reset staff/user password directly or with temporary password under a tenant' })
  async resetPassword(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @CurrentUser() currentUser: User,
    @Body() resetPasswordDto?: ResetPasswordDto,
  ) {
    const r = await this.userManagementService.resetPassword(id, currentUser, tenantId, resetPasswordDto);
    const u = await this.userManagementService.findOne(id);
    await this.log(currentUser, tenantId, 'staff.password_reset', u, `Reset the password for ${u.name} (${u.email})`);
    return r;
  }
}

function roleWord(role?: string): string {
  return ({ tenant_admin: 'company admin', manager: 'manager', cashier: 'cashier', super_admin: 'platform admin' } as Record<string, string>)[role ?? ''] ?? role ?? '';
}
