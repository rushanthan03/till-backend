import { BadRequestException, Body, Controller, Get, Headers, Put, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../infrastructure/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../infrastructure/auth/guards/roles.guard';
import { Roles } from '../infrastructure/auth/decorators/roles.decorator';
import { CurrentUser } from '../infrastructure/auth/decorators/current-user.decorator';
import { UserRole } from '../infrastructure/database/entities';
import { PermissionsService } from './permissions.service';

const ALL = [UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN, UserRole.MANAGER, UserRole.CASHIER];
const ADMINS = [UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN];

/** The company a request is about: the user's own, or (platform admin) the x-tenant-id header. */
export function companyOf(user: any, headerTenant?: string): string {
  const id = user.role === UserRole.SUPER_ADMIN ? headerTenant || user.tenantId : user.tenantId;
  if (!id) throw new BadRequestException('Choose a company first');
  return id;
}

@ApiTags('Permissions')
@Controller('permissions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PermissionsController {
  constructor(private readonly permissions: PermissionsService) {}

  @Get('me')
  @Roles(...ALL)
  @ApiOperation({ summary: 'What the signed-in user may do (yes / pin / no for each permission)' })
  mine(@CurrentUser() user: any) {
    return this.permissions.mine(user);
  }

  @Get()
  @Roles(...ADMINS)
  @ApiOperation({ summary: "The company's role permissions, with the list of permissions and defaults" })
  get(@CurrentUser() user: any, @Headers('x-tenant-id') tenant?: string) {
    return this.permissions.settings(companyOf(user, tenant));
  }

  @Put()
  @Roles(...ADMINS)
  @ApiOperation({ summary: 'Change role permissions, e.g. { "cashier": { "refunds": "pin" } }' })
  update(@Body() body: Record<string, unknown>, @CurrentUser() user: any, @Headers('x-tenant-id') tenant?: string) {
    return this.permissions.update(companyOf(user, tenant), body?.roles ?? body, { id: user.id, name: user.name, role: user.role, tenantId: user.tenantId });
  }
}
