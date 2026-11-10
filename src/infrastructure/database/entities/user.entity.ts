import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Tenant } from './tenant.entity';
import { Restaurant } from './restaurant.entity';

export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  TENANT_ADMIN = 'tenant_admin',
  MANAGER = 'manager',
  CASHIER = 'cashier',
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
}

@Entity('users')
@Index(['email'], { unique: true })
@Index(['phoneNumber'])
@Index(['tenantId'])
// Number a member of staff types with their PIN at the till; unique within the company.
@Index('UQ_users_employee_number', ['tenantId', 'employeeNumber'], { unique: true, where: `"employeeNumber" IS NOT NULL` })
@Index(['restaurantId'])
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ nullable: true })
  phoneNumber: string;

  @Column()
  password: string;

  @Column({ type: 'varchar', nullable: true })
  employeeNumber: string | null;

  /** Hashed 4-6 digit PIN a manager enters on the till to approve discounts and overrides. */
  @Column({ type: 'varchar', nullable: true, select: false })
  pinHash: string | null;

  @Column()
  name: string;

  @Column({ type: 'enum', enum: UserRole })
  role: UserRole;

  @Column({ type: 'enum', enum: UserStatus, default: UserStatus.ACTIVE })
  status: UserStatus;

  @Column({ nullable: true })
  avatar: string;

  @Column({ type: 'jsonb', nullable: true })
  permissions: string[];

  @Column({ type: 'timestamp', nullable: true })
  lastLoginAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  emailVerifiedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  phoneVerifiedAt: Date;

  @Column({ nullable: true })
  refreshToken: string;

  @Column({ type: 'timestamp', nullable: true })
  refreshTokenExpiresAt: Date;

  // For tenant isolation
  @Column({ nullable: true })
  tenantId: string;

  @ManyToOne(() => Tenant, (tenant) => tenant.users, { nullable: true })
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  // Store assignment (nullable: tenant admins are not tied to one store)
  // The property keeps its name (it is part of the login response); the database column is `storeId`.
  @Column({ type: 'uuid', nullable: true, name: 'storeId' })
  restaurantId: string;

  @ManyToOne(() => Restaurant, (restaurant) => restaurant.users, { nullable: true })
  @JoinColumn({ name: 'storeId' })
  restaurant: Restaurant;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
