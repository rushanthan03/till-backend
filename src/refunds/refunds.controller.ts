import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../infrastructure/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../infrastructure/auth/guards/roles.guard';
import { Roles } from '../infrastructure/auth/decorators/roles.decorator';
import { NeedsPermission } from '../permissions/permissions.decorator';
import { CurrentUser } from '../infrastructure/auth/decorators/current-user.decorator';
import { resolveStoreId } from '../infrastructure/auth/store-scope';
import { UserRole } from '../infrastructure/database/entities';
import { RefundsService } from './refunds.service';
import { CreateRefundDto } from './dto/refund.dto';

// Who may refund (and whether a cashier needs a manager's PIN) is set per company in Permissions.
const TILL_ROLES = [UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN, UserRole.MANAGER, UserRole.CASHIER];
const REFUND_ROLES = [UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN, UserRole.MANAGER];

@ApiTags('Refunds')
@Controller('refunds')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RefundsController {
  constructor(private readonly refunds: RefundsService) {}

  @Post()
  @Roles(...TILL_ROLES)
  @NeedsPermission('refunds')
  @ApiOperation({ summary: 'Refund items from a sale (money out of the open till session)' })
  @ApiQuery({ name: 'storeId', required: false })
  create(@Body() dto: CreateRefundDto, @Query('storeId') storeId: string, @CurrentUser() user: any) {
    return this.refunds.create(resolveStoreId(storeId, user), { id: user.id, name: user.name, role: user.role, tenantId: user.tenantId }, dto);
  }

  @Get()
  @Roles(...REFUND_ROLES)
  @NeedsPermission('reports', 'refunds')
  @ApiQuery({ name: 'storeId', required: false })
  list(@Query('storeId') storeId: string, @Query('page') page: string, @Query('limit') limit: string, @CurrentUser() user: any) {
    return this.refunds.findAll(resolveStoreId(storeId, user), Number(page) || 1, Math.min(Number(limit) || 25, 200));
  }

  @Get(':id')
  @Roles(...REFUND_ROLES)
  @NeedsPermission('reports', 'refunds')
  @ApiQuery({ name: 'storeId', required: false })
  get(@Param('id', ParseUUIDPipe) id: string, @Query('storeId') storeId: string, @CurrentUser() user: any) {
    return this.refunds.findOne(id, resolveStoreId(storeId, user));
  }
}
