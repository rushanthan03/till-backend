import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, ManyToOne, JoinColumn, ValueTransformer } from 'typeorm';
import { Restaurant } from './restaurant.entity';

const decimalTransformer: ValueTransformer = {
  to: (value?: number | null) => value,
  from: (value?: string | null) => (value === null || value === undefined ? value : parseFloat(value)),
};

/**
 * A loyalty customer of a company (tenant), usable in every one of its stores. Points are earned on sales
 * (1 point per £1 paid) and the balance is shared. `storeId` is the store the customer signed up at.
 */
@Entity('customers')
@Index(['tenantId', 'cardNumber'], { unique: true })
@Index(['tenantId', 'phone'])
export class Customer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  /** Store where the customer signed up. */
  @Column({ type: 'uuid', name: 'storeId' })
  storeId: string;

  @ManyToOne(() => Restaurant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'storeId' })
  restaurant: Restaurant;

  /** Number on the loyalty card; also what the till scans or types. */
  @Column()
  cardNumber: string;

  @Column()
  name: string;

  @Column({ type: 'varchar', nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', nullable: true })
  email: string | null;

  /** Agreed to receive marketing (UK GDPR / PECR: must be opt-in). */
  @Column({ type: 'boolean', default: false })
  marketingConsent: boolean;

  @Column({ type: 'int', default: 0 })
  pointsBalance: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, transformer: decimalTransformer })
  totalSpend: number;

  @Column({ type: 'int', default: 0 })
  visitCount: number;

  @Column({ type: 'timestamp', nullable: true })
  lastVisitAt: Date | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
