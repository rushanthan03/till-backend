import { AuditLogService } from '../audit-log/audit-log.service';
import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../infrastructure/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../infrastructure/auth/guards/roles.guard';
import { Roles } from '../infrastructure/auth/decorators/roles.decorator';
import { NeedsPermission } from '../permissions/permissions.decorator';
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
  constructor(
    private readonly promotions: PromotionsService,
    private readonly audit: AuditLogService,
  ) {}

  @Get()
  @Roles(...ALL)
  @ApiOperation({ summary: 'Promotions of a store; current=true returns only offers running now (used by the till)' })
  list(@Query() q: ListPromotionsQueryDto, @CurrentUser() user: any) {
    return this.promotions.list(resolveStoreId(q.storeId, user), q);
  }

  @Post()
  @Roles(...MANAGERS)
  @NeedsPermission('promotions')
  @ApiOperation({ summary: 'Create a promotion' })
  @ApiQuery({ name: 'storeId', required: false })
  async create(@Body() dto: CreatePromotionDto, @Query('storeId') storeId: string, @CurrentUser() user: any) {
    const sid = resolveStoreId(storeId, user);
    const p = await this.promotions.create(sid, dto);
    await this.audit.record({ actor: user, storeId: sid, action: 'promotion.create', entityType: 'promotion', entityId: p.id, summary: `Created offer "${p.name}"`, details: { ...dto } });
    return p;
  }

  @Patch(':id')
  @Roles(...MANAGERS)
  @NeedsPermission('promotions')
  @ApiOperation({ summary: 'Edit a promotion, or switch it on/off with isActive' })
  @ApiQuery({ name: 'storeId', required: false })
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePromotionDto, @Query('storeId') storeId: string, @CurrentUser() user: any) {
    const sid = resolveStoreId(storeId, user);
    const p = await this.promotions.update(id, sid, dto);
    const keys = Object.keys(dto);
    const what = keys.length === 1 && keys[0] === 'isActive' ? (dto.isActive ? 'Switched on' : 'Switched off') : 'Changed';
    await this.audit.record({ actor: user, storeId: sid, action: 'promotion.update', entityType: 'promotion', entityId: id, summary: `${what} offer "${p.name}"`, details: { ...dto } });
    return p;
  }
}
