import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../infrastructure/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../infrastructure/auth/guards/roles.guard';
import { Roles } from '../infrastructure/auth/decorators/roles.decorator';
import { NeedsPermission } from '../permissions/permissions.decorator';
import { CurrentUser } from '../infrastructure/auth/decorators/current-user.decorator';
import { resolveStoreId } from '../infrastructure/auth/store-scope';
import { UserRole } from '../infrastructure/database/entities';
import { StockService } from './stock.service';
import { AdjustStockDto, GoodsReceiptDto, ListMovementsQueryDto, StocktakeDto } from './dto/stock.dto';

const MANAGERS = [UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN, UserRole.MANAGER];

@ApiTags('Stock')
@Controller('stock')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...MANAGERS)
@NeedsPermission('stock')
export class StockController {
  constructor(private readonly stock: StockService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Stock headline figures: low, out, negative, value, 30-day write-offs' })
  @ApiQuery({ name: 'storeId', required: false })
  summary(@Query('storeId') storeId: string, @CurrentUser() user: any) {
    return this.stock.summary(resolveStoreId(storeId, user));
  }

  @Get('movements')
  @ApiOperation({ summary: 'Stock history: filter by product, type, text and dates' })
  list(@Query() q: ListMovementsQueryDto, @CurrentUser() user: any) {
    return this.stock.list(resolveStoreId(q.storeId, user), q);
  }

  @Post('receipts')
  @ApiOperation({ summary: 'Goods receipt: book a delivery into stock' })
  @ApiQuery({ name: 'storeId', required: false })
  receive(@Body() dto: GoodsReceiptDto, @Query('storeId') storeId: string, @CurrentUser() user: any) {
    return this.stock.receive(resolveStoreId(storeId, user), { id: user.id, name: user.name }, dto);
  }

  @Post('adjustments')
  @ApiOperation({ summary: 'Adjust stock or write off waste, damaged and expired goods' })
  @ApiQuery({ name: 'storeId', required: false })
  adjust(@Body() dto: AdjustStockDto, @Query('storeId') storeId: string, @CurrentUser() user: any) {
    return this.stock.adjust(resolveStoreId(storeId, user), { id: user.id, name: user.name }, dto);
  }

  @Post('stocktakes')
  @ApiOperation({ summary: 'Submit a stocktake: counted quantities replace system stock, differences are recorded' })
  @ApiQuery({ name: 'storeId', required: false })
  stocktake(@Body() dto: StocktakeDto, @Query('storeId') storeId: string, @CurrentUser() user: any) {
    return this.stock.stocktake(resolveStoreId(storeId, user), { id: user.id, name: user.name }, dto);
  }
}
