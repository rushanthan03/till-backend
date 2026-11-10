import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../infrastructure/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../infrastructure/auth/guards/roles.guard';
import { Roles } from '../infrastructure/auth/decorators/roles.decorator';
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
  constructor(private readonly customers: CustomersService) {}

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
  @ApiOperation({ summary: 'Edit a customer (managers): details, consent, deactivate' })
  @ApiQuery({ name: 'storeId', required: false })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCustomerDto, @Query('storeId') storeId: string, @CurrentUser() user: any) {
    return this.customers.update(id, resolveStoreId(storeId, user), dto);
  }

  @Get(':id/export')
  @Roles(...MANAGERS)
  @ApiOperation({ summary: 'Download everything held about a customer (data subject access request)' })
  @ApiQuery({ name: 'storeId', required: false })
  export(@Param('id', ParseUUIDPipe) id: string, @Query('storeId') storeId: string, @CurrentUser() user: any) {
    return this.customers.exportData(id, resolveStoreId(storeId, user));
  }

  @Post(':id/erase')
  @HttpCode(200)
  @Roles(...MANAGERS)
  @ApiOperation({ summary: "Erase a customer's personal data (right to erasure). Cannot be undone." })
  @ApiQuery({ name: 'storeId', required: false })
  erase(@Param('id', ParseUUIDPipe) id: string, @Query('storeId') storeId: string, @CurrentUser() user: any) {
    return this.customers.erase(id, resolveStoreId(storeId, user));
  }
}
