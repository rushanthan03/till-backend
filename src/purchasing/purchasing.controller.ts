import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../infrastructure/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../infrastructure/auth/guards/roles.guard';
import { Roles } from '../infrastructure/auth/decorators/roles.decorator';
import { CurrentUser } from '../infrastructure/auth/decorators/current-user.decorator';
import { resolveStoreId } from '../infrastructure/auth/store-scope';
import { UserRole } from '../infrastructure/database/entities';
import { PurchasingService } from './purchasing.service';
import {
  CreatePurchaseOrderDto, CreateSupplierDto, ListPurchaseOrdersQueryDto, ListSuppliersQueryDto, ReceivePurchaseOrderDto, SuggestionsQueryDto, UpdatePurchaseOrderDto, UpdateSupplierDto,
} from './dto/purchasing.dto';

const MANAGERS = [UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN, UserRole.MANAGER];
const actor = (user: any) => ({ id: user.id, name: user.name });

@ApiTags('Suppliers')
@Controller('suppliers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...MANAGERS)
export class SuppliersController {
  constructor(private readonly purchasing: PurchasingService) {}

  @Get()
  @ApiOperation({ summary: "The company's suppliers, with product and open-order counts for this store" })
  list(@Query() q: ListSuppliersQueryDto, @CurrentUser() user: any) {
    return this.purchasing.listSuppliers(resolveStoreId(q.storeId, user), q);
  }

  @Get(':id')
  @ApiQuery({ name: 'storeId', required: false })
  get(@Param('id', ParseUUIDPipe) id: string, @Query('storeId') storeId: string, @CurrentUser() user: any) {
    return this.purchasing.getSupplier(id, resolveStoreId(storeId, user));
  }

  @Post()
  @ApiOperation({ summary: 'Add a supplier (shared by every store in the company)' })
  @ApiQuery({ name: 'storeId', required: false })
  create(@Body() dto: CreateSupplierDto, @Query('storeId') storeId: string, @CurrentUser() user: any) {
    return this.purchasing.createSupplier(resolveStoreId(storeId, user), dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edit or deactivate a supplier' })
  @ApiQuery({ name: 'storeId', required: false })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSupplierDto, @Query('storeId') storeId: string, @CurrentUser() user: any) {
    return this.purchasing.updateSupplier(id, resolveStoreId(storeId, user), dto);
  }
}

@ApiTags('Purchase orders')
@Controller('purchase-orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...MANAGERS)
export class PurchaseOrdersController {
  constructor(private readonly purchasing: PurchasingService) {}

  @Get()
  @ApiOperation({ summary: "This store's purchase orders" })
  list(@Query() q: ListPurchaseOrdersQueryDto, @CurrentUser() user: any) {
    return this.purchasing.listOrders(resolveStoreId(q.storeId, user), q);
  }

  @Get('suggestions')
  @ApiOperation({ summary: 'Products to reorder: at or below reorder level, less what is already on order' })
  suggestions(@Query() q: SuggestionsQueryDto, @CurrentUser() user: any) {
    return this.purchasing.suggestions(resolveStoreId(q.storeId, user), q.supplierId);
  }

  @Get(':id')
  @ApiQuery({ name: 'storeId', required: false })
  get(@Param('id', ParseUUIDPipe) id: string, @Query('storeId') storeId: string, @CurrentUser() user: any) {
    return this.purchasing.getOrder(id, resolveStoreId(storeId, user));
  }

  @Post()
  @ApiOperation({ summary: 'Create a purchase order (draft, or ordered with submit: true)' })
  @ApiQuery({ name: 'storeId', required: false })
  create(@Body() dto: CreatePurchaseOrderDto, @Query('storeId') storeId: string, @CurrentUser() user: any) {
    return this.purchasing.createOrder(resolveStoreId(storeId, user), actor(user), dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Change a draft order' })
  @ApiQuery({ name: 'storeId', required: false })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePurchaseOrderDto, @Query('storeId') storeId: string, @CurrentUser() user: any) {
    return this.purchasing.updateOrder(id, resolveStoreId(storeId, user), dto);
  }

  @Post(':id/submit')
  @HttpCode(200)
  @ApiOperation({ summary: 'Mark a draft as ordered (sent to the supplier)' })
  @ApiQuery({ name: 'storeId', required: false })
  submit(@Param('id', ParseUUIDPipe) id: string, @Query('storeId') storeId: string, @CurrentUser() user: any) {
    return this.purchasing.submitOrder(id, resolveStoreId(storeId, user));
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cancel a draft or open order (on a part-delivered order, cancels the rest)' })
  @ApiQuery({ name: 'storeId', required: false })
  cancel(@Param('id', ParseUUIDPipe) id: string, @Query('storeId') storeId: string, @CurrentUser() user: any) {
    return this.purchasing.cancelOrder(id, resolveStoreId(storeId, user));
  }

  @Post(':id/receive')
  @HttpCode(200)
  @ApiOperation({ summary: 'Book a delivery against the order: raises stock and records goods-in' })
  @ApiQuery({ name: 'storeId', required: false })
  receive(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReceivePurchaseOrderDto, @Query('storeId') storeId: string, @CurrentUser() user: any) {
    return this.purchasing.receiveOrder(id, resolveStoreId(storeId, user), actor(user), dto);
  }
}
