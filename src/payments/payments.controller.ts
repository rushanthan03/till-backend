import { Body, Controller, Get, HttpCode, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../infrastructure/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../infrastructure/auth/guards/roles.guard';
import { Roles } from '../infrastructure/auth/decorators/roles.decorator';
import { CurrentUser } from '../infrastructure/auth/decorators/current-user.decorator';
import { resolveStoreId } from '../infrastructure/auth/store-scope';
import { UserRole } from '../infrastructure/database/entities';
import { PaymentsService } from './payments.service';
import { ChargeDto } from './dto/payment.dto';

const ALL = [UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN, UserRole.MANAGER, UserRole.CASHIER];

@ApiTags('Payments')
@Controller('payments/terminal')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ALL)
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get('status')
  @ApiOperation({ summary: 'Which card terminal provider is in use and whether it is reachable' })
  status() {
    return this.payments.status();
  }

  @Post('charge')
  @HttpCode(200)
  @ApiOperation({ summary: 'Take a card payment on the terminal. Returns approved or declined; the sale then carries the returned reference.' })
  @ApiQuery({ name: 'storeId', required: false })
  charge(@Body() dto: ChargeDto, @Query('storeId') storeId: string, @CurrentUser() user: any) {
    return this.payments.charge(resolveStoreId(storeId, user), user.id, dto);
  }
}
