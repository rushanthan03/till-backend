import { DataSource } from 'typeorm';
import { User, UserRole, UserStatus } from '../entities';
import * as bcrypt from 'bcrypt';


export class SuperAdminSeeder {
  constructor(private dataSource: DataSource) { }

  async run(): Promise<void> {
    const userRepository = this.dataSource.getRepository(User);

    // Check if super admin already exists
    const existingSuperAdmin = await userRepository.findOne({
      where: { role: UserRole.SUPER_ADMIN },
    });

    if (existingSuperAdmin) {
      console.log('Super admin already exists');
      return;
    }

    // Create super admin
    const superAdmin = userRepository.create({
      email: (process.env.SUPER_ADMIN_EMAIL || 'admin@till.local').toLowerCase(),
      password: await bcrypt.hash(
        process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin@123',
        10
      ),
      name: 'Super Admin',
      role: UserRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      emailVerifiedAt: new Date(),
    });

    await userRepository.save(superAdmin);
    console.log('Super admin created successfully');
  }
}
