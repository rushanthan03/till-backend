# Supermarket Till – Backend

NestJS + PostgreSQL API for a supermarket till (EPOS): products and barcodes, VAT-inclusive pricing, sales with split payments, refunds, till sessions (X/Z reports, blind cash-up) and multi-tenant store management.

## Requirements
- Node.js 18+
- PostgreSQL 12+

## Run it

1. **Create the database**
   ```bash
   psql -U postgres -c "CREATE DATABASE till_pos"
   ```

2. **Configure environment**
   ```bash
   cp env.example .env
   ```
   Edit `.env`: set `DATABASE_PASSWORD`, `DATABASE_NAME` and the two JWT secrets (long random strings).

3. **Install and start**
   ```bash
   npm install
   npm run start:dev
   ```
   With `NODE_ENV=development` the tables are created automatically on first start.
   API: http://localhost:4000/api — Swagger docs: http://localhost:4000/api/docs

4. **Create the super admin (once)**
   ```bash
   npx ts-node -r tsconfig-paths/register -e "import {AppDataSource} from './src/infrastructure/database/data-source'; import {SuperAdminSeeder} from './src/infrastructure/database/seeders/super-admin.seeder'; AppDataSource.initialize().then(async d=>{await new SuperAdminSeeder(d).run(); await d.destroy();})"
   ```
   Login: `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` from `.env` (defaults `admin@till.local` / `SuperAdmin@123`).

5. **Load demo data (optional)** – one tenant, two stores, 100 products per store, manager and cashier users:
   ```bash
   npm run seed:demo
   ```
   All demo users use password `Till@12345` (override with `DEMO_PASSWORD=...`):

   | Role | Email |
   |---|---|
   | Tenant admin | admin@freshmarket.test |
   | Manager | manager.hs@freshmarket.test, manager.sr@freshmarket.test |
   | Cashier | cashier1.hs@, cashier2.hs@, cashier1.sr@, cashier2.sr@ freshmarket.test |

## Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_HOST/PORT/USERNAME/PASSWORD/NAME` | PostgreSQL connection |
| `JWT_ACCESS_TOKEN_SECRET`, `JWT_REFRESH_TOKEN_SECRET` | Token signing keys |
| `JWT_ACCESS_TOKEN_EXPIRATION_TIME`, `JWT_REFRESH_TOKEN_EXPIRATION_TIME` | e.g. `1h`, `7d` |
| `NODE_ENV` | `development` auto-syncs tables; `production` requires migrations |
| `PORT` | API port (default 4000) |
| `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD` | First super admin created by the seeder |

## Scripts
| Command | What it does |
|---|---|
| `npm run start:dev` | Start with auto-reload |
| `npm run build` / `npm run start:prod` | Production build and run |
| `npm run seed:demo` | Load demo tenant, stores, users and products |
| `npm run migration:run` | Apply database migrations (production) |
| `npm run test:unit` | Unit tests (sales, refunds, shifts maths) |

## Roles
`super_admin` (platform) · `tenant_admin` (company) · `manager` (refunds, reports, products) · `cashier` (till only).

## Main endpoints
`/api/auth/login` · `/api/tenants` · `/api/tenants/:id/outlets` (stores) · `/api/tenants/:id/users` · `/api/products` · `/api/sales` · `/api/refunds` · `/api/shifts`

## Production database
Development uses automatic table sync. For production run migrations (`npm run migration:run`, PostgreSQL 12+). Do **not** apply the output of `npm run migration:generate` as-is: older migrations and entities have drifted, so a generated diff contains unrelated statements, including `DROP COLUMN`. Write migrations by hand or keep only the statements for the tables you changed.

## Notes
- The store is stored as `restaurants` / `restaurantId` in the database and API paths (`/restaurants`, `/outlets`). This is a legacy name only; it means "store".
- Logo/banner uploads use AWS S3 and are optional.
