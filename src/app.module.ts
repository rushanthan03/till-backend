import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import * as Joi from 'joi';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ApplicationExceptionsFilter, ApplicationLogger } from './infrastructure';
import { AuthModule } from './infrastructure/auth';
import { TYPES } from './application/constants';
import { TenantModule } from './tenant/tenant.module';
import { UserManagementModule } from './user-management/user-management.module';
import { OutletModule } from './outlet/outlet.module';
import { RestaurantModule } from './restaurant/restaurant.module';
import { UploadModule } from './upload/upload.module';
import { TenantMiddleware } from './infrastructure/middlewares/tenant.middleware';
import {
  Tenant,
  Restaurant,
  User,
  Product,
  Sale,
  SaleItem,
  SalePayment,
  Shift,
  CashMovement,
  StockMovement,
  Promotion,
  Customer,
  Refund,
  RefundItem,
  RefundPayment,
} from './infrastructure/database/entities';
import { ProductModule } from './product/product.module';
import { SalesModule } from './sales/sales.module';
import { PromotionsModule } from './promotions/promotions.module';
import { CustomersModule } from './customers/customers.module';
import { StockModule } from './stock/stock.module';
import { ApprovalsModule } from './approvals/approvals.module';
import { ShiftsModule } from './shifts/shifts.module';
import { RefundsModule } from './refunds/refunds.module';
import { MIGRATIONS } from './infrastructure/database/migrations';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local', '.env.production'],
      validationSchema: Joi.object({
        DATABASE_HOST: Joi.string().required(),
        DATABASE_PORT: Joi.number().required(),
        DATABASE_USERNAME: Joi.string().required(),
        DATABASE_PASSWORD: Joi.string().required(),
        DATABASE_NAME: Joi.string().required(),
        JWT_ACCESS_TOKEN_SECRET: Joi.string().required(),
        JWT_ACCESS_TOKEN_EXPIRATION_TIME: Joi.string().required(),
        JWT_REFRESH_TOKEN_SECRET: Joi.string().required(),
        JWT_REFRESH_TOKEN_EXPIRATION_TIME: Joi.string().required(),
        NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
        PORT: Joi.number().default(4000),
          }),
    }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (config: ConfigService) => ({
        secret: config.get<string>('JWT_ACCESS_TOKEN_SECRET'),
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DATABASE_HOST'),
        port: configService.get<number>('DATABASE_PORT'),
        username: configService.get<string>('DATABASE_USERNAME'),
        password: configService.get<string>('DATABASE_PASSWORD'),
        database: configService.get<string>('DATABASE_NAME'),
        // Use direct entity imports for better production compatibility
        entities: [
          Tenant,
          Restaurant,
          User,
          Product,
          Sale,
          SaleItem,
          SalePayment,
          Shift,
          CashMovement,
          StockMovement,
          Promotion,
          Customer,
          Refund,
          RefundItem,
          RefundPayment,
        ],
        synchronize: configService.get<string>('NODE_ENV') === 'development',
        migrations: MIGRATIONS,
        // migrationsRun: true,
        //logging: configService.get<string>('NODE_ENV') === 'development',
        logging: false,
        ssl: configService.get<string>('NODE_ENV') === 'production' ? { rejectUnauthorized: false } : false,
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([
      Tenant,
      Restaurant,
      User,
      ]),
    AuthModule,
    TenantModule,
    UserManagementModule,
    OutletModule,
    RestaurantModule,
    UploadModule,
    ProductModule,
    SalesModule,
    ApprovalsModule,
    StockModule,
    PromotionsModule,
    CustomersModule,
    ShiftsModule,
    RefundsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    TenantMiddleware,
    {
      provide: APP_FILTER,
      useClass: ApplicationExceptionsFilter,
    },
    {
      provide: TYPES.IApplicationLogger,
      useClass: ApplicationLogger,
    },
    ApplicationLogger,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantMiddleware)
      .exclude('invoice/(.*)', 'receipt/(.*)', 'invoices/view/(.*)', 'v1/invoices/view/(.*)', 'health', '/', 'api/docs')
      .forRoutes('*');
  }
}
