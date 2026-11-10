import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../infrastructure/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../infrastructure/auth/guards/roles.guard';
import { Roles } from '../infrastructure/auth/decorators/roles.decorator';
import { CurrentUser } from '../infrastructure/auth/decorators/current-user.decorator';
import { resolveStoreId } from '../infrastructure/auth/store-scope';
import { UserRole } from '../infrastructure/database/entities';
import { ShiftsService } from './shifts.service';
import { CloseShiftDto, CountCashDto, ListShiftsQueryDto, OpenShiftDto } from './dto/shift.dto';

const TILL_ROLES = [UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN, UserRole.MANAGER, UserRole.CASHIER];
const MANAGER_ROLES = [UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN, UserRole.MANAGER];

@ApiTags('Shifts (till sessions)')
@Controller('shifts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ShiftsController {
  constructor(private readonly shifts: ShiftsService) {}

  @Get('current')
  @Roles(...TILL_ROLES)
  @ApiOperation({ summary: "The caller's open till session, or null" })
  @ApiQuery({ name: 'storeId', required: false })
  async current(@Query('storeId') storeId: string, @CurrentUser() user: any) {
    return (await this.shifts.findOpen(resolveStoreId(storeId, user), user.id)) ?? null;
  }

  @Post('open')
  @Roles(...TILL_ROLES)
  @ApiOperation({ summary: 'Open the till with a starting float' })
  @ApiQuery({ name: 'storeId', required: false })
  open(@Body() dto: OpenShiftDto, @Query('storeId') storeId: string, @CurrentUser() user: any) {
    return this.shifts.open(resolveStoreId(storeId, user), { id: user.id, name: user.name }, dto);
  }

  @Get('current/x-report')
  @Roles(...TILL_ROLES)
  @ApiOperation({ summary: 'X report: running totals for the open session (does not close it)' })
  @ApiQuery({ name: 'storeId', required: false })
  async xReport(@Query('storeId') storeId: string, @CurrentUser() user: any) {
    const shift = await this.shifts.requireOpen(resolveStoreId(storeId, user), user.id);
    return this.shifts.xReport(shift);
  }

  @Post('current/count')
  @Roles(...TILL_ROLES)
  @ApiOperation({ summary: 'Blind cash-up step: submit the count, see expected cash and the difference (nothing saved)' })
  @ApiQuery({ name: 'storeId', required: false })
  async count(@Body() dto: CountCashDto, @Query('storeId') storeId: string, @CurrentUser() user: any) {
    const shift = await this.shifts.requireOpen(resolveStoreId(storeId, user), user.id);
    return this.shifts.previewClose(shift, dto.countedCash);
  }

  @Post('current/close')
  @Roles(...TILL_ROLES)
  @ApiOperation({ summary: 'Close the till session and produce the Z report' })
  @ApiQuery({ name: 'storeId', required: false })
  close(@Body() dto: CloseShiftDto, @Query('storeId') storeId: string, @CurrentUser() user: any) {
    return this.shifts.close(resolveStoreId(storeId, user), user.id, dto);
  }

  @Get()
  @Roles(...MANAGER_ROLES)
  @ApiOperation({ summary: 'Till session history: filter by status, cashier, dates, or only sessions with a cash difference' })
  list(@Query() query: ListShiftsQueryDto, @CurrentUser() user: any) {
    return this.shifts.list(resolveStoreId(query.storeId, user), query);
  }

  @Get('summary')
  @Roles(...MANAGER_ROLES)
  @ApiOperation({ summary: 'Headline numbers for the same filters as the list' })
  summary(@Query() query: ListShiftsQueryDto, @CurrentUser() user: any) {
    return this.shifts.summary(resolveStoreId(query.storeId, user), query);
  }

  @Get(':id')
  @Roles(...MANAGER_ROLES)
  @ApiOperation({ summary: 'One session with its figures (live if open, saved Z report if closed)' })
  @ApiQuery({ name: 'storeId', required: false })
  get(@Param('id', ParseUUIDPipe) id: string, @Query('storeId') storeId: string, @CurrentUser() user: any) {
    return this.shifts.detail(id, resolveStoreId(storeId, user));
  }
}
