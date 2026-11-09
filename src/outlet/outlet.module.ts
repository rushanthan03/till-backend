import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OutletController, OutletDirectController } from './outlet.controller';
import { OutletService } from './outlet.service';
import { Restaurant } from '../infrastructure/database/entities';
import { S3Service } from '@/shared/services/s3.service';
import { RestaurantModule } from '@/restaurant/restaurant.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Restaurant]),
    RestaurantModule,
  ],
  controllers: [OutletController, OutletDirectController],
  providers: [OutletService, S3Service],
  exports: [OutletService, S3Service],
})
export class OutletModule {}
