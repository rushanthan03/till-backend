import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  ValueTransformer,
} from 'typeorm';
import { Restaurant } from './restaurant.entity';

// Postgres returns DECIMAL columns as strings; convert them to numbers.
const decimalTransformer: ValueTransformer = {
  to: (value?: number | null) => value,
  from: (value?: string | null) => (value === null || value === undefined ? value : parseFloat(value)),
};

export enum ProductUnitType {
  EACH = 'each',
  WEIGHT = 'weight',
}

/**
 * A sellable supermarket product. `restaurantId` is the store (outlet) the
 * product belongs to - the column name is kept for compatibility with the
 * existing tenant/outlet model.
 */
@Entity('products')
@Index(['restaurantId'])
@Index(['restaurantId', 'barcode'], { unique: true })
@Index(['restaurantId', 'department'])
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  restaurantId: string;

  @ManyToOne(() => Restaurant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'restaurantId' })
  restaurant: Restaurant;

  @Column()
  name: string;

  @Column()
  barcode: string;

  @Column({ type: 'varchar', nullable: true })
  sku: string | null;

  @Column()
  department: string;

  @Column({ type: 'varchar', nullable: true })
  category: string | null;

  @Column({ type: 'varchar', nullable: true })
  brand: string | null;

  @Column({ type: 'enum', enum: ProductUnitType, default: ProductUnitType.EACH })
  unitType: ProductUnitType;

  /** Shelf price INCLUDING VAT. For weighed items this is the price per kg. */
  @Column({ type: 'decimal', precision: 10, scale: 2, transformer: decimalTransformer })
  price: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, transformer: decimalTransformer })
  costPrice: number | null;

  /** VAT percentage, e.g. 0, 5 or 20. */
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 20, transformer: decimalTransformer })
  vatRate: number;

  /** Minimum legal age to buy (0 = unrestricted, e.g. 18 for alcohol/tobacco). */
  @Column({ type: 'int', default: 0 })
  ageRestriction: number;

  @Column({ type: 'decimal', precision: 12, scale: 3, default: 0, transformer: decimalTransformer })
  stockQuantity: number;

  @Column({ type: 'decimal', precision: 12, scale: 3, default: 0, transformer: decimalTransformer })
  reorderLevel: number;

  @Column({ type: 'varchar', nullable: true })
  imageUrl: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
