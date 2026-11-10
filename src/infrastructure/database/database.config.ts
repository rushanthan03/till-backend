import { databaseSsl } from '../config/database-ssl';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { SuperAdminSeeder } from './seeders/super-admin.seeder';
import {
  Tenant, User, Restaurant, Product, Sale, SaleItem, SalePayment, Shift, Refund, RefundItem, RefundPayment,
} from './entities';
import { MIGRATIONS } from './migrations';

export const createDataSource = (configService: ConfigService): DataSource => {
  return new DataSource({
    type: 'postgres',
    host: configService.get<string>('DATABASE_HOST'),
    port: configService.get<number>('DATABASE_PORT'),
    username: configService.get<string>('DATABASE_USERNAME'),
    password: configService.get<string>('DATABASE_PASSWORD'),
    database: configService.get<string>('DATABASE_NAME'),
    entities: [
      Tenant, User, Restaurant, Product, Sale, SaleItem, SalePayment, Shift, Refund, RefundItem, RefundPayment,
    ],
    migrations: MIGRATIONS,
    synchronize: configService.get<string>('NODE_ENV') === 'development',
    logging: configService.get<string>('NODE_ENV') === 'development',
    ssl: databaseSsl({ NODE_ENV: configService.get<string>('NODE_ENV'), DATABASE_SSL: configService.get<string>('DATABASE_SSL') }),
  });
};

export const runSeeders = async (dataSource: DataSource): Promise<void> => {
  if (!dataSource.isInitialized) {
    await dataSource.initialize();
  }

  const superAdminSeeder = new SuperAdminSeeder(dataSource);
  await superAdminSeeder.run();
};
