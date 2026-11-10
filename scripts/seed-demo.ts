/**
 * Demo data: one tenant, two stores, staff users and a 100-product catalogue per store.
 * Safe to re-run (skips what already exists).   npm run seed:demo
 */
import 'reflect-metadata';
import * as bcrypt from 'bcrypt';
import { AppDataSource } from '../src/infrastructure/database/data-source';
import { Tenant, Restaurant, User, Product, TenantType, TenantStatus, UserRole, UserStatus } from '../src/infrastructure/database/entities';
import { buildSeedRows } from '../src/product/product.seed';

const PASSWORD = process.env.DEMO_PASSWORD || 'Till@12345';

const STORES = [
  { name: 'Fresh Market - High Street', city: 'Leeds', lane: '42 High Street', district: 'West Yorkshire', code: 'hs' },
  { name: 'Fresh Market - Station Road', city: 'York', lane: '8 Station Road', district: 'North Yorkshire', code: 'sr' },
];

async function main() {
  const ds = await AppDataSource.initialize();
  const tenants = ds.getRepository(Tenant);
  const stores = ds.getRepository(Restaurant);
  const users = ds.getRepository(User);
  const products = ds.getRepository(Product);
  const hash = await bcrypt.hash(PASSWORD, 10);

  let tenant = await tenants.findOne({ where: { subdomain: 'freshmarket' } });
  if (!tenant) {
    tenant = await tenants.save(tenants.create({
      name: 'Fresh Market Ltd', subdomain: 'freshmarket', type: TenantType.STORE, status: TenantStatus.ACTIVE,
      contactEmail: 'office@freshmarket.test', contactPhoneNumber: '+441130000000',
      address: { lane: '1 Market Square', city: 'Leeds', district: 'West Yorkshire', country: 'United Kingdom' } as any,
    } as any) as any) as Tenant;
    console.log('Created tenant Fresh Market Ltd');
  }

  const out: string[] = [];
  const addUser = async (email: string, name: string, role: UserRole, restaurantId: string | null) => {
    if (await users.findOne({ where: { email } })) return;
    await users.save(users.create({
      email, name, role, status: UserStatus.ACTIVE, password: hash, emailVerifiedAt: new Date(),
      tenantId: tenant!.id, restaurantId: restaurantId as any,
    }));
    out.push(`${role.padEnd(13)} ${email}`);
  };

  const first: Restaurant[] = [];
  for (const s of STORES) {
    let store = await stores.findOne({ where: { tenantId: tenant.id, name: s.name } });
    if (!store) {
      store = await stores.save(stores.create({
        name: s.name, tenantId: tenant.id, status: 'active', isActive: true,
        contactEmail: `${s.code}@freshmarket.test`, contactPhoneNumber: '+441130000001',
        openTime: '08:00', closeTime: '22:00',
        address: { lane: s.lane, city: s.city, district: s.district, country: 'United Kingdom' },
      } as any) as any) as Restaurant;
      console.log(`Created store ${s.name}`);
    }
    first.push(store);

    const have = new Set((await products.find({ where: { storeId: store.id }, select: ['barcode'] })).map((p) => p.barcode));
    const rows = buildSeedRows(store.id).filter((r) => !have.has(r.barcode));
    if (rows.length) await products.save(rows.map((r) => ({ ...r } as any)));
    console.log(`  ${s.name}: ${rows.length} products added`);

    await addUser(`manager.${s.code}@freshmarket.test`, `Manager ${s.city}`, UserRole.MANAGER, store.id);
    await addUser(`cashier1.${s.code}@freshmarket.test`, `Cashier 1 ${s.city}`, UserRole.CASHIER, store.id);
    await addUser(`cashier2.${s.code}@freshmarket.test`, `Cashier 2 ${s.city}`, UserRole.CASHIER, store.id);
  }
  await addUser('admin@freshmarket.test', 'Fresh Market Admin', UserRole.TENANT_ADMIN, first[0].id);

  // Approval PINs (managers/admins) used for discounts and price overrides on the till.
  const PINS: Record<string, string> = {
    'manager.hs@freshmarket.test': '2580',
    'manager.sr@freshmarket.test': '2580',
    'admin@freshmarket.test': '1234',
  };
  for (const [email, pin] of Object.entries(PINS)) {
    await users.update({ email }, { pinHash: await bcrypt.hash(pin, 10) });
  }
  console.log('Approval PINs set: managers 2580, tenant admin 1234');

  console.log('\nLogins created (password for all: ' + PASSWORD + ')');
  out.forEach((l) => console.log('  ' + l));
  await ds.destroy();
}
main().catch((e) => { console.error('Seed failed:', e.message); process.exit(1); });
