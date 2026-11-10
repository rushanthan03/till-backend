import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product, Sale, SaleItem, SalePayment } from '../infrastructure/database/entities';
import { PaymentsModule } from '../payments/payments.module';
import { ApprovalsModule } from '../approvals/approvals.module';
import { SalesService } from './sales.service';
import { SalesController } from './sales.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Sale, SaleItem, SalePayment, Product]), ApprovalsModule, PaymentsModule],
  controllers: [SalesController],
  providers: [SalesService],
  exports: [SalesService],
})
export class SalesModule {}
