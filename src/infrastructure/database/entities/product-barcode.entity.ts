import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { Product } from './product.entity';

/**
 * An extra barcode for a product, e.g. the multipack or case barcode.
 * Scanning it adds `packQuantity` units of the product. Barcodes are unique
 * within a store across both this table and products.barcode.
 */
@Entity('product_barcodes')
@Index(['storeId', 'barcode'], { unique: true })
@Index(['productId'])
export class ProductBarcode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  storeId: string;

  @Column({ type: 'uuid' })
  productId: string;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column()
  barcode: string;

  /** Units added per scan (1 = another code for a single item). */
  @Column({ type: 'int', default: 1 })
  packQuantity: number;

  @Column({ type: 'varchar', nullable: true })
  label: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
