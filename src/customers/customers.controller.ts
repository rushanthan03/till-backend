import { AuditLogService } from '../audit-log/audit-log.service';
import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../infrastructure/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../infrastructure/auth/guards/roles.guard';
import { Roles } from '../infrastructure/auth/decorators/roles.decorator';
import { NeedsPermission } from '../permissions/permissions.decorator';
import { CurrentUser } from '../infrastructure/auth/decorators/current-user.decorator';
import { resolveStoreId } from '../infrastructure/auth/store-scope';
import { UserRole } from '../infrastructure/database/entities';
import { CustomersService } from './customers.service';
import { CreateCustomerDto, ListCustomersQueryDto, UpdateCustomerDto } from './dto/customer.dto';

const ALL = [UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN, UserRole.MANAGER, UserRole.CASHIER];
const MANAGERS = [UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN, UserRole.MANAGER];

@ApiTags('Customers')
@Controller('customers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CustomersController {
  constructor(
    private readonly customers: CustomersService,
    private readonly audit: AuditLogService,
  ) {}

  @Get()
  @Roles(...ALL)
  @ApiOperation({ summary: 'Find loyalty customers by name, phone, email or card number' })
  list(@Query() q: ListCustomersQueryDto, @CurrentUser() user: any) {
    return this.customers.list(resolveStoreId(q.storeId, user), q);
  }

  @Get(':id')
  @Roles(...ALL)
  @ApiQuery({ name: 'storeId', required: false })
  get(@Param('id', ParseUUIDPipe) id: string, @Query('storeId') storeId: string, @CurrentUser() user: any) {
    return this.customers.findOne(id, resolveStoreId(storeId, user));
  }

  @Post()
  @Roles(...ALL)
  @ApiOperation({ summary: 'Sign a customer up to the loyalty scheme (cashiers can do this at the till)' })
  @ApiQuery({ name: 'storeId', required: false })
  create(@Body() dto: CreateCustomerDto, @Query('storeId') storeId: string, @CurrentUser() user: any) {
    return this.customers.create(resolveStoreId(storeId, user), dto);
  }

  @Patch(':id')
  @Roles(...MANAGERS)
  @NeedsPermission('customers')
  @ApiOperation({ summary: 'Edit a customer (managers): details, consent, deactivate' })
  @ApiQuery({ name: 'storeId', required: false })
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCustomerDto, @Query('storeId') storeId: string, @CurrentUser() user: any) {
    const sid = resolveStoreId(storeId, user);
    const c = await this.customers.update(id, sid, dto);
    await this.audit.record({ actor: user, storeId: sid, action: 'customer.update', entityType: 'customer', entityId: id, summary: `Changed customer ${c.name}${c.cardNumber ? ` (${c.cardNumber})` : ''}: ${Object.keys(dto).join(', ')}` });
    return c;
  }

  @Get(':id/export')
  @Roles(...MANAGERS)
  @NeedsPermission('customers')
  @ApiOperation({ summary: 'Download everything held about a customer (data subject access request)' })
  @ApiQuery({ name: 'storeId', required: false })
  async export(@Param('id', ParseUUIDPipe) id: string, @Query('storeId') storeId: string, @CurrentUser() user: any) {
    const sid = resolveStoreId(storeId, user);
    const data: any = await this.customers.exportData(id, sid);
    const c = data?.customer ?? data;
    await this.audit.record({ actor: user, storeId: sid, action: 'customer.export', entityType: 'customer', entityId: id, summary: `Downloaded all data held about ${c?.name ?? 'a customer'}${c?.cardNumber ? ` (${c.cardNumber})` : ''}` });
    return data;
  }

  @Post(':id/erase')
  @HttpCode(200)
  @Roles(...MANAGERS)
  @NeedsPermission('customers')
  @ApiOperation({ summary: "Erase a customer's personal data (right to erasure). Cannot be undone." })
  @ApiQuery({ name: 'storeId', required: false })
  async erase(@Param('id', ParseUUIDPipe) id: string, @Query('storeId') storeId: string, @CurrentUser() user: any) {
    const sid = resolveStoreId(storeId, user);
    const r = await this.customers.erase(id, sid);
    // The name is gone after erasure, so the log keeps only the card number.
    await this.audit.record({ actor: user, storeId: sid, action: 'customer.erase', entityType: 'customer', entityId: id, summary: `Erased a customer's personal data${r.cardNumber ? ` (card ${r.cardNumber})` : ''}` });
    return { id: r.id, erased: true };
  }
}
