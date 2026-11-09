import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Restaurant } from '../infrastructure/database/entities';
import { RestaurantsController } from './restaurant.controller';
import { RestaurantService } from './restaurant.service';
import { RestaurantMapper } from './restaurant.mapper';
import { RestaurantRepository } from './../infrastructure/data_access/repositories/restaurant.repository';
import { TYPES } from './../application/constants/types';
import { AuditMapper } from '../audit/audit.mapper';
import { ContextService } from '../infrastructure/context/context.service';
import { AuthModule } from '../infrastructure/auth/auth.module';
import { AuthService } from '../infrastructure/auth/auth.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AccessControlService } from '../shared/services/access_control.service';
import { RoleService } from '../shared/services/role_service';
import { ContextMiddleWare } from '../infrastructure/middlewares/context.middleware';
import { S3Service } from '@/shared/services/s3.service';


@Module({
  imports: [
    TypeOrmModule.forFeature([Restaurant]),
    AuthModule,
  ],
  controllers: [RestaurantsController],
  providers: [
    RestaurantService,
    { provide: TYPES.IRestaurantService, useClass: RestaurantService },
    { provide: TYPES.IRestaurantRepository, useClass: RestaurantRepository },
    { provide: TYPES.IContextService, useClass: ContextService },
    { provide: TYPES.IAuthService, useClass: AuthService },
    { provide: TYPES.IAccessControlService, useClass: AccessControlService },
    { provide: TYPES.IRoleService, useClass: RoleService },
    RestaurantMapper,
    RestaurantRepository,
    AuditMapper,
    ContextService,
    AuthService,
    JwtService,
    ConfigService,
    AccessControlService,
    RoleService,
    S3Service
  ],
  exports: [RestaurantService, S3Service],
})
export class RestaurantModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(ContextMiddleWare).forRoutes(RestaurantsController);
  }
}
