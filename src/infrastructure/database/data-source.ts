import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import {
    Tenant, User, Restaurant, Product, Sale, SaleItem, SalePayment, Shift, CashMovement, StockMovement, Refund, RefundItem, RefundPayment,
} from './entities';
import { MIGRATIONS } from './migrations';

dotenv.config();

export const AppDataSource = new DataSource({
    type: 'postgres',
    host: process.env.DATABASE_HOST,
    port: parseInt(process.env.DATABASE_PORT || '5432'),
    username: process.env.DATABASE_USERNAME,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
    synchronize: false,
    logging: process.env.NODE_ENV === 'development',
    entities: [
        Tenant, User, Restaurant, Product, Sale, SaleItem, SalePayment, Shift, CashMovement, StockMovement, Refund, RefundItem, RefundPayment,
    ],
    migrations: MIGRATIONS,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});
