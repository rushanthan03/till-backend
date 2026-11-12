import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, ManyToOne, JoinColumn, ValueTransformer } from 'typeorm';
import { Restaurant } from './restaurant.entity';

const decimalTransformer: ValueTransformer = {
  to: (value?: number | null) => value,
  from: (value?: string | null) => (value === null || value === undefined ? value : parseFloat(value)),
};

export enum PromotionType {
  /** A percentage off the shelf price. */
  PERCENT_OFF = 'percent_off',
  /** Buy N for a fixed bundle price (e.g. 3 for £5). */
  MULTIBUY = 'multibuy',
  /** Buy X, get Y more of the same item free (e.g. buy 2 get 1 free). */
  BUY_GET_FREE = 'buy_get_free',
}

export enum PromotionScope {
  PRODUCT = 'product',
  DEPARTMENT = 'department',
}

/** An offer applied automatically at the till while it is active and in date. */
@Entity('promotions')
@Index(['storeId', 'isActive'])
export class Promotion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'storeId' })
  storeId: string;

  @ManyToOne(() => Restaurant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'storeId' })
  restaurant: Restaurant;

  @Column()
  name: string;

  @Column({ type: 'enum', enum: PromotionType })
  type: PromotionType;

  @Column({ type: 'enum', enum: PromotionScope })
  scope: PromotionScope;

  @Column({ type: 'uuid', nullable: true })
  productId: string | null;

  @Column({ type: 'varchar', nullable: true })
  department: string | null;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true, transformer: decimalTransformer })
  percentOff: number | null;

  /** Multibuy: how many make the bundle. Buy-get-free: how many the customer pays for. */
  @Column({ type: 'int', nullable: true })
  buyQty: number | null;

  /** Buy-get-free: how many more are free once buyQty have been bought. */
  @Column({ type: 'int', nullable: true })
  freeQty: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, transformer: decimalTransformer })
  bundlePrice: number | null;

  @Column({ type: 'timestamp', nullable: true })
  startsAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  endsAt: Date | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
