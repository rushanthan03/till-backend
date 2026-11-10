import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  OneToMany,
  JoinColumn,
  ValueTransformer,
} from 'typeorm';
import { Restaurant } from './restaurant.entity';
import { Product } from './product.entity';

const decimalTransformer: ValueTransformer = {
  to: (value?: number | null) => value,
  from: (value?: string | null) => (value === null || value === undefined ? value : parseFloat(value)),
};

export enum SaleStatus {
  COMPLETED = 'completed',
  PARTIALLY_REFUNDED = 'partially_refunded',
  REFUNDED = 'refunded',
  VOIDED = 'voided',
}

export enum SalePaymentMethod {
  CASH = 'cash',
  CARD = 'card',
}

/** A completed till sale (one receipt). `storeId` is the store. */
@Entity('sales')
@Index(['storeId', 'receiptSeq'], { unique: true })
@Index(['storeId', 'createdAt'])
export class Sale {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'restaurantId' })
  storeId: string;

  @ManyToOne(() => Restaurant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'restaurantId' })
  restaurant: Restaurant;

  /** Sequential per-store number; the printed receipt number is derived from it. */
  @Column({ type: 'int' })
  receiptSeq: number;

  @Column()
  receiptNumber: string;

  @Column({ type: 'uuid', nullable: true })
  cashierId: string | null;

  @Column({ type: 'varchar', nullable: true })
  cashierName: string | null;

  /** The till session (shift) this sale was rung up in. */
  @Column({ type: 'uuid', nullable: true })
  shiftId: string | null;

  @Column({ type: 'enum', enum: SaleStatus, default: SaleStatus.COMPLETED })
  status: SaleStatus;

  /** Total payable, VAT included. */
  @Column({ type: 'decimal', precision: 12, scale: 2, transformer: decimalTransformer })
  total: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, transformer: decimalTransformer })
  netTotal: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, transformer: decimalTransformer })
  vatTotal: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, transformer: decimalTransformer })
  changeDue: number;

  /** Running total refunded against this sale (VAT included). */
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, transformer: decimalTransformer })
  refundedTotal: number;

  @Column({ type: 'int' })
  itemCount: number;

  /** True when the cashier confirmed the customer's age for restricted items. */
  @Column({ type: 'boolean', default: false })
  ageVerified: boolean;

  @OneToMany(() => SaleItem, (item) => item.sale, { cascade: true })
  items: SaleItem[];

  @OneToMany(() => SalePayment, (payment) => payment.sale, { cascade: true })
  payments: SalePayment[];

  @CreateDateColumn()
  createdAt: Date;
}

/** Line snapshot: name/price/VAT are copied so later product edits never change history. */
@Entity('sale_items')
@Index(['saleId'])
export class SaleItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  saleId: string;

  @ManyToOne(() => Sale, (sale) => sale.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'saleId' })
  sale: Sale;

  @Column({ type: 'uuid', nullable: true })
  productId: string | null;

  @ManyToOne(() => Product, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'productId' })
  product: Product | null;

  @Column()
  name: string;

  @Column()
  barcode: string;

  @Column({ type: 'decimal', precision: 12, scale: 3, transformer: decimalTransformer })
  quantity: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, transformer: decimalTransformer })
  unitPrice: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, transformer: decimalTransformer })
  vatRate: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, transformer: decimalTransformer })
  lineTotal: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, transformer: decimalTransformer })
  vatAmount: number;

  @Column({ type: 'int', default: 0 })
  ageRestriction: number;

  /** How much of this line has been refunded so far (quantity, value and VAT). */
  @Column({ type: 'decimal', precision: 12, scale: 3, default: 0, transformer: decimalTransformer })
  refundedQuantity: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, transformer: decimalTransformer })
  refundedAmount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, transformer: decimalTransformer })
  refundedVat: number;
}

@Entity('sale_payments')
@Index(['saleId'])
export class SalePayment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  saleId: string;

  @ManyToOne(() => Sale, (sale) => sale.payments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'saleId' })
  sale: Sale;

  @Column({ type: 'enum', enum: SalePaymentMethod })
  method: SalePaymentMethod;

  /** Amount applied to the bill (never more than what was owed). */
  @Column({ type: 'decimal', precision: 12, scale: 2, transformer: decimalTransformer })
  amount: number;

  /** Cash handed over by the customer (cash only). */
  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true, transformer: decimalTransformer })
  tendered: number | null;

  /** Card terminal / authorisation reference (card only). */
  @Column({ type: 'varchar', nullable: true })
  reference: string | null;
}
