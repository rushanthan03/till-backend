import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product, PurchaseOrder, PurchaseOrderLine, Restaurant, Supplier } from '../infrastructure/database/entities';
import { PurchasingService } from './purchasing.service';
import { PurchaseOrdersController, SuppliersController } from './purchasing.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Supplier, PurchaseOrder, PurchaseOrderLine, Product, Restaurant])],
  controllers: [SuppliersController, PurchaseOrdersController],
  providers: [PurchasingService],
  exports: [PurchasingService],
})
export class PurchasingModule {}
