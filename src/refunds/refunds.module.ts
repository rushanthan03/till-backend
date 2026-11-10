import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product, Refund, Sale, SaleItem, SalePayment, Shift } from '../infrastructure/database/entities';
import { PaymentsModule } from '../payments/payments.module';
import { RefundsService } from './refunds.service';
import { RefundsController } from './refunds.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Refund, Sale, SaleItem, SalePayment, Shift, Product]), PaymentsModule],
  controllers: [RefundsController],
  providers: [RefundsService],
  exports: [RefundsService],
})
export class RefundsModule {}
