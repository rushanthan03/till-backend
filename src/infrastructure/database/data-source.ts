import { databaseSsl } from '../config/database-ssl';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import {
    Tenant, User, Restaurant, Product, ProductBarcode, Supplier, PurchaseOrder, PurchaseOrderLine, Sale, SaleItem, SalePayment, Shift, CashMovement, StockMovement, CardCharge, TimeEntry, Promotion, Customer, Refund, RefundItem, RefundPayment, AuditLog,
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
        Tenant, User, Restaurant, Product, ProductBarcode, Supplier, PurchaseOrder, PurchaseOrderLine, Sale, SaleItem, SalePayment, Shift, CashMovement, StockMovement, CardCharge, TimeEntry, Promotion, Customer, Refund, RefundItem, RefundPayment, AuditLog,
    ],
    migrations: MIGRATIONS,
    ssl: databaseSsl({ NODE_ENV: process.env.NODE_ENV, DATABASE_SSL: process.env.DATABASE_SSL }),
});
