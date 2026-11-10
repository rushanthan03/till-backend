import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, ManyToOne, JoinColumn, ValueTransformer } from 'typeorm';
import { Restaurant } from './restaurant.entity';
import { Product } from './product.entity';

const decimalTransformer: ValueTransformer = {
  to: (value?: number | null) => value,
  from: (value?: string | null) => (value === null || value === undefined ? value : parseFloat(value)),
};

export enum StockMovementType {
  OPENING = 'opening',
  GOODS_RECEIPT = 'goods_receipt',
  ADJUSTMENT = 'adjustment',
  WASTE = 'waste',
  DAMAGED = 'damaged',
  EXPIRED = 'expired',
  STOCKTAKE = 'stocktake',
  SALE = 'sale',
  REFUND_RESTOCK = 'refund_restock',
}

/** Ledger of every change to a product's stock: who, why, and the level afterwards. */
@Entity('stock_movements')
@Index(['storeId', 'createdAt'])
@Index(['productId', 'createdAt'])
export class StockMovement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'restaurantId' })
  storeId: string;

  @ManyToOne(() => Restaurant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'restaurantId' })
  restaurant: Restaurant;

  @Column({ type: 'uuid' })
  productId: string;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column({ type: 'enum', enum: StockMovementType })
  type: StockMovementType;

  /** Signed change: positive adds stock, negative removes it. */
  @Column({ type: 'decimal', precision: 12, scale: 3, transformer: decimalTransformer })
  quantity: number;

  /** Stock level after this change. */
  @Column({ type: 'decimal', precision: 12, scale: 3, transformer: decimalTransformer })
  quantityAfter: number;

  /** Unit cost at the time (goods receipts). */
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, transformer: decimalTransformer })
  unitCost: number | null;

  @Column({ type: 'varchar', nullable: true })
  reason: string | null;

  /** Supplier delivery note / invoice number, receipt number, stocktake id... */
  @Column({ type: 'varchar', nullable: true })
  reference: string | null;

  @Column({ type: 'varchar', nullable: true })
  supplier: string | null;

  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ type: 'varchar', nullable: true })
  userName: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
