import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../infrastructure/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../infrastructure/auth/guards/roles.guard';
import { Roles } from '../infrastructure/auth/decorators/roles.decorator';
import { CurrentUser } from '../infrastructure/auth/decorators/current-user.decorator';
import { resolveStoreId } from '../infrastructure/auth/store-scope';
import { UserRole } from '../infrastructure/database/entities';
import { AttendanceService } from './attendance.service';
import { AttendanceQueryDto } from './dto/attendance.dto';

const ALL = [UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN, UserRole.MANAGER, UserRole.CASHIER];
const MANAGERS = [UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN, UserRole.MANAGER];

@ApiTags('Attendance')
@Controller('attendance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @Get('status')
  @Roles(...ALL)
  @ApiOperation({ summary: 'Am I clocked in? Returns the open entry or null' })
  @ApiQuery({ name: 'storeId', required: false })
  async status(@Query('storeId') storeId: string, @CurrentUser() user: any) {
    return (await this.attendance.status(resolveStoreId(storeId, user), user.id)) ?? null;
  }

  @Post('clock-in')
  @Roles(...ALL)
  @ApiOperation({ summary: 'Clock in (safe to repeat)' })
  @ApiQuery({ name: 'storeId', required: false })
  clockIn(@Query('storeId') storeId: string, @CurrentUser() user: any) {
    return this.attendance.clockIn(resolveStoreId(storeId, user), { id: user.id, name: user.name });
  }

  @Post('clock-out')
  @Roles(...ALL)
  @ApiOperation({ summary: 'Clock out (the till must be closed first)' })
  @ApiQuery({ name: 'storeId', required: false })
  clockOut(@Query('storeId') storeId: string, @CurrentUser() user: any) {
    return this.attendance.clockOut(resolveStoreId(storeId, user), user.id);
  }

  @Get()
  @Roles(...MANAGERS)
  @ApiOperation({ summary: 'Hours worked per person and every clock entry (managers)' })
  report(@Query() q: AttendanceQueryDto, @CurrentUser() user: any) {
    return this.attendance.report(resolveStoreId(q.storeId, user), q);
  }
}
