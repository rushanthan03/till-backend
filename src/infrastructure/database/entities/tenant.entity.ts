import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { Restaurant } from './restaurant.entity';
import { User } from './user.entity';

export enum TenantStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
}

export enum TenantType {
  // Stored as 'restaurant' in the database (legacy value, renaming needs a data migration)
  STORE = 'restaurant',
}

export enum SubscriptionPlan {
  BASIC = 'basic',
  PRO = 'pro',
  ENTERPRISE = 'enterprise',
}

@Entity('tenants')
@Index(['subdomain'], { unique: true })
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ unique: true })
  subdomain: string;

  @Column({ type: 'enum', enum: TenantType })
  type: TenantType;

  @Column({ type: 'enum', enum: TenantStatus, default: TenantStatus.ACTIVE })
  status: TenantStatus;

  @Column({ type: 'enum', enum: SubscriptionPlan, nullable: true })
  subscriptionPlan: SubscriptionPlan;

  @Column({ nullable: true })
  contactEmail: string;

  @Column({ nullable: true })
  contactPhoneNumber: string;

  @Column({ nullable: true })
  logo: string;

  @Column({ nullable: true })
  description: string;

  @Column({ type: 'jsonb', nullable: true })
  settings: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  address: {
    lane: string;
    city: string;
    district: string;
    country: string;
  };

  @Column({ type: 'jsonb', nullable: true })
  billingInfo: Record<string, any>;

  @Column({ type: 'timestamp', nullable: true })
  subscriptionExpiresAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @OneToMany(() => Restaurant, (restaurant) => restaurant.tenant)
  restaurants: Restaurant[];

  @OneToMany(() => User, (user) => user.tenant)
  users: User[];
}
