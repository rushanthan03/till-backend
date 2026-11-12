import { Body, Controller, HttpCode, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../infrastructure/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../infrastructure/auth/guards/roles.guard';
import { Roles } from '../infrastructure/auth/decorators/roles.decorator';
import { NeedsPermission } from '../permissions/permissions.decorator';
import { CurrentUser } from '../infrastructure/auth/decorators/current-user.decorator';
import { resolveStoreId } from '../infrastructure/auth/store-scope';
import { UserRole } from '../infrastructure/database/entities';
import { ApprovalsService, APPROVER_ROLES } from './approvals.service';
import { SetPinDto, StaffCredentialsDto, VerifyPinDto } from './dto/approval.dto';

@ApiTags('Approvals')
@Controller('approvals')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ApprovalsController {
  constructor(private readonly approvals: ApprovalsService) {}

  @Post('verify')
  @HttpCode(200)
  @Roles(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN, UserRole.MANAGER, UserRole.CASHIER)
  @ApiOperation({ summary: 'Check a manager PIN; returns a 5-minute approval token for discounts and price overrides' })
  @ApiQuery({ name: 'storeId', required: false })
  verify(@Body() dto: VerifyPinDto, @Query('storeId') storeId: string, @CurrentUser() user: any) {
    return this.approvals.verifyPin(resolveStoreId(storeId, user), { id: user.id, name: user.name, role: user.role, tenantId: user.tenantId }, dto.pin);
  }

  @Post('pin')
  @HttpCode(200)
  @Roles(...APPROVER_ROLES)
  @ApiOperation({ summary: 'Set or change your own approval PIN (managers and admins)' })
  setPin(@Body() dto: SetPinDto, @CurrentUser() user: any) {
    return this.approvals.setPin(user.id, dto.pin);
  }
}

@ApiTags('Staff sign-in')
@Controller('staff')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StaffCredentialsController {
  constructor(private readonly approvals: ApprovalsService) {}

  @Post(':userId/till-login')
  @HttpCode(200)
  @Roles(...APPROVER_ROLES)
  @NeedsPermission('staff')
  @ApiOperation({ summary: "Set a member of staff's employee number and till PIN (managers: own store's cashiers)" })
  set(@Param('userId', ParseUUIDPipe) userId: string, @Body() dto: StaffCredentialsDto, @CurrentUser() user: any) {
    return this.approvals.setStaffCredentials({ id: user.id, role: user.role, tenantId: user.tenantId, restaurantId: user.restaurantId }, userId, dto);
  }
}
