import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, ManyToOne, JoinColumn, ValueTransformer } from 'typeorm';
import { Restaurant } from './restaurant.entity';

const decimalTransformer: ValueTransformer = {
  to: (value?: number | null) => value,
  from: (value?: string | null) => (value === null || value === undefined ? value : parseFloat(value)),
};

export enum CashMovementType {
  /** Cash added to the drawer (e.g. change from the safe). */
  PAID_IN = 'paid_in',
  /** Cash taken out for an expense (e.g. window cleaner, milk run). */
  PAID_OUT = 'paid_out',
  /** Excess cash moved from the drawer to the safe. */
  SAFE_DROP = 'safe_drop',
  /** Drawer opened without a sale. Amount is always 0. */
  NO_SALE = 'no_sale',
}

/** Every time cash goes in or out of a drawer outside a sale or refund, or the drawer is opened without a sale. */
@Entity('cash_movements')
@Index(['shiftId'])
@Index(['storeId', 'createdAt'])
export class CashMovement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'restaurantId' })
  storeId: string;

  @ManyToOne(() => Restaurant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'restaurantId' })
  restaurant: Restaurant;

  @Column({ type: 'uuid' })
  shiftId: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column()
  userName: string;

  @Column({ type: 'enum', enum: CashMovementType })
  type: CashMovementType;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, transformer: decimalTransformer })
  amount: number;

  @Column()
  reason: string;

  @Column({ type: 'uuid', nullable: true })
  approvedById: string | null;

  @Column({ type: 'varchar', nullable: true })
  approvedByName: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
