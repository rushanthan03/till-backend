import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../infrastructure/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../infrastructure/auth/guards/roles.guard';
import { Roles } from '../infrastructure/auth/decorators/roles.decorator';
import { CurrentUser } from '../infrastructure/auth/decorators/current-user.decorator';
import { resolveStoreId } from '../infrastructure/auth/store-scope';
import { UserRole } from '../infrastructure/database/entities';
import { PromotionsService } from './promotions.service';
import { CreatePromotionDto, ListPromotionsQueryDto, UpdatePromotionDto } from './dto/promotion.dto';

const ALL = [UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN, UserRole.MANAGER, UserRole.CASHIER];
const MANAGERS = [UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN, UserRole.MANAGER];

@ApiTags('Promotions')
@Controller('promotions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PromotionsController {
  constructor(private readonly promotions: PromotionsService) {}

  @Get()
  @Roles(...ALL)
  @ApiOperation({ summary: 'Promotions of a store; current=true returns only offers running now (used by the till)' })
  list(@Query() q: ListPromotionsQueryDto, @CurrentUser() user: any) {
    return this.promotions.list(resolveStoreId(q.storeId, user), q);
  }

  @Post()
  @Roles(...MANAGERS)
  @ApiOperation({ summary: 'Create a promotion' })
  @ApiQuery({ name: 'storeId', required: false })
  create(@Body() dto: CreatePromotionDto, @Query('storeId') storeId: string, @CurrentUser() user: any) {
    return this.promotions.create(resolveStoreId(storeId, user), dto);
  }

  @Patch(':id')
  @Roles(...MANAGERS)
  @ApiOperation({ summary: 'Edit a promotion, or switch it on/off with isActive' })
  @ApiQuery({ name: 'storeId', required: false })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePromotionDto, @Query('storeId') storeId: string, @CurrentUser() user: any) {
    return this.promotions.update(id, resolveStoreId(storeId, user), dto);
  }
}
