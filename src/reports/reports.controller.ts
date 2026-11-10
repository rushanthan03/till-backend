import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../infrastructure/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../infrastructure/auth/guards/roles.guard';
import { Roles } from '../infrastructure/auth/decorators/roles.decorator';
import { CurrentUser } from '../infrastructure/auth/decorators/current-user.decorator';
import { resolveStoreId } from '../infrastructure/auth/store-scope';
import { UserRole } from '../infrastructure/database/entities';
import { ReportsService } from './reports.service';
import { ProductReportQueryDto, ReportQueryDto } from './dto/report.dto';

@ApiTags('Reports')
@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN, UserRole.MANAGER)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('vat')
  @ApiOperation({ summary: 'VAT report: sales, refunds and VAT due by VAT rate' })
  vat(@Query() q: ReportQueryDto, @CurrentUser() user: any) {
    return this.reports.vat(resolveStoreId(q.storeId, user), q);
  }

  @Get('tender')
  @ApiOperation({ summary: 'Tender report: cash and card sales, refunds and net' })
  tender(@Query() q: ReportQueryDto, @CurrentUser() user: any) {
    return this.reports.tender(resolveStoreId(q.storeId, user), q);
  }

  @Get('departments')
  @ApiOperation({ summary: 'Department sales: units, gross, refunds, discounts, share of net' })
  departments(@Query() q: ReportQueryDto, @CurrentUser() user: any) {
    return this.reports.departments(resolveStoreId(q.storeId, user), q);
  }

  @Get('products')
  @ApiOperation({ summary: 'Product sales: best sellers by revenue, quantity or estimated margin' })
  products(@Query() q: ProductReportQueryDto, @CurrentUser() user: any) {
    return this.reports.products(resolveStoreId(q.storeId, user), q);
  }
}
