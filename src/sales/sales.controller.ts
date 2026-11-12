import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../infrastructure/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../infrastructure/auth/guards/roles.guard';
import { Roles } from '../infrastructure/auth/decorators/roles.decorator';
import { NeedsPermission } from '../permissions/permissions.decorator';
import { CurrentUser } from '../infrastructure/auth/decorators/current-user.decorator';
import { resolveStoreId } from '../infrastructure/auth/store-scope';
import { UserRole } from '../infrastructure/database/entities';
import { SalesService } from './sales.service';
import { CreateSaleDto, EmailReceiptDto, ListSalesQueryDto } from './dto/sale.dto';

// Staff who may ring up sales (an open till session is also required).
const SELL_ROLES = [UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN, UserRole.MANAGER, UserRole.CASHIER];
const REPORT_ROLES = [UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN, UserRole.MANAGER];

@ApiTags('Sales')
@Controller('sales')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post()
  @Roles(...SELL_ROLES)
  @ApiOperation({ summary: 'Complete a till sale (prices, VAT and stock are calculated server-side)' })
  @ApiQuery({ name: 'storeId', required: false })
  create(@Body() dto: CreateSaleDto, @Query('storeId') storeId: string, @CurrentUser() user: any) {
    return this.salesService.create(resolveStoreId(storeId, user), { id: user.id, name: user.name, role: user.role, tenantId: user.tenantId }, dto);
  }

  @Get()
  @Roles(...SELL_ROLES)
  @NeedsPermission('reports', 'refunds')
  @ApiOperation({ summary: 'Sales history (managers and above): filter by receipt, cashier, status, payment method and dates' })
  list(@Query() query: ListSalesQueryDto, @CurrentUser() user: any) {
    return this.salesService.findAll(resolveStoreId(query.storeId, user), query);
  }

  @Get('summary')
  @Roles(...REPORT_ROLES)
  @NeedsPermission('reports')
  @ApiOperation({ summary: 'Sales totals for a period (default today)' })
  @ApiQuery({ name: 'storeId', required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'shiftId', required: false, description: 'Limit the figures to one till session' })
  summary(
    @Query('storeId') storeId: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('shiftId', new ParseUUIDPipe({ optional: true })) shiftId: string | undefined,
    @CurrentUser() user: any,
  ) {
    return this.salesService.summary(resolveStoreId(storeId, user), from, to, shiftId);
  }

  @Get(':id')
  @Roles(...SELL_ROLES)
  @NeedsPermission('reports', 'refunds')
  @ApiOperation({ summary: 'One sale with its lines, payments and refunds' })
  @ApiQuery({ name: 'storeId', required: false })
  get(@Param('id', ParseUUIDPipe) id: string, @Query('storeId') storeId: string, @CurrentUser() user: any) {
    return this.salesService.findOne(id, resolveStoreId(storeId, user));
  }

  @Post(':id/email-receipt')
  @HttpCode(200)
  @Roles(...SELL_ROLES)
  @ApiOperation({ summary: 'Email the receipt, or a gift receipt (no prices), to the customer' })
  @ApiQuery({ name: 'storeId', required: false })
  emailReceipt(@Param('id', ParseUUIDPipe) id: string, @Body() dto: EmailReceiptDto, @Query('storeId') storeId: string, @CurrentUser() user: any) {
    return this.salesService.emailReceipt(id, resolveStoreId(storeId, user), { id: user.id, name: user.name, role: user.role, tenantId: user.tenantId }, dto);
  }
}
