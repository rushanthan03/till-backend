import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, ManyToOne, OneToMany, JoinColumn, ValueTransformer } from 'typeorm';
import { Restaurant } from './restaurant.entity';
import { Sale, SalePaymentMethod } from './sale.entity';

const decimalTransformer: ValueTransformer = {
  to: (value?: number | null) => value,
  from: (value?: string | null) => (value === null || value === undefined ? value : parseFloat(value)),
};

export enum RefundReason {
  FAULTY = 'faulty',
  DAMAGED = 'damaged',
  WRONG_ITEM = 'wrong_item',
  CHANGED_MIND = 'changed_mind',
  PRICE_ERROR = 'price_error',
  OTHER = 'other',
}

/** What happens to the physical goods that come back. */
export enum RefundDisposition {
  RESTOCK = 'restock', // back on the shelf: stock goes up
  WASTE = 'waste', // thrown away: stock unchanged, recorded as waste
  DAMAGED = 'damaged', // damaged / supplier return: stock unchanged
}

@Entity('refunds')
@Index(['storeId', 'refundSeq'], { unique: true })
@Index(['saleId'])
@Index(['shiftId'])
export class Refund {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'storeId' })
  storeId: string;

  @ManyToOne(() => Restaurant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'storeId' })
  restaurant: Restaurant;

  @Column({ type: 'int' })
  refundSeq: number;

  @Column()
  refundNumber: string;

  @Column({ type: 'uuid' })
  saleId: string;

  @ManyToOne(() => Sale, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'saleId' })
  sale: Sale;

  /** Receipt number of the original sale, copied for easy display. */
  @Column()
  originalReceiptNumber: string;

  /** The till session the money went out of. */
  @Column({ type: 'uuid' })
  shiftId: string;

  @Column({ type: 'uuid', nullable: true })
  processedById: string | null;

  @Column({ type: 'varchar', nullable: true })
  processedByName: string | null;

  @Column({ type: 'enum', enum: RefundReason })
  reason: RefundReason;

  @Column({ type: 'varchar', nullable: true })
  note: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, transformer: decimalTransformer })
  total: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, transformer: decimalTransformer })
  vatTotal: number;

  @OneToMany(() => RefundItem, (i) => i.refund, { cascade: true })
  items: RefundItem[];

  @OneToMany(() => RefundPayment, (p) => p.refund, { cascade: true })
  payments: RefundPayment[];

  @CreateDateColumn()
  createdAt: Date;
}

@Entity('refund_items')
@Index(['refundId'])
export class RefundItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  refundId: string;

  @ManyToOne(() => Refund, (r) => r.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'refundId' })
  refund: Refund;

  @Column({ type: 'uuid' })
  saleItemId: string;

  @Column({ type: 'uuid', nullable: true })
  productId: string | null;

  @Column()
  name: string;

  @Column({ type: 'decimal', precision: 12, scale: 3, transformer: decimalTransformer })
  quantity: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, transformer: decimalTransformer })
  lineTotal: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, transformer: decimalTransformer })
  vatAmount: number;

  @Column({ type: 'enum', enum: RefundDisposition })
  disposition: RefundDisposition;
}

@Entity('refund_payments')
@Index(['refundId'])
export class RefundPayment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  refundId: string;

  @ManyToOne(() => Refund, (r) => r.payments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'refundId' })
  refund: Refund;

  @Column({ type: 'enum', enum: SalePaymentMethod })
  method: SalePaymentMethod;

  @Column({ type: 'decimal', precision: 12, scale: 2, transformer: decimalTransformer })
  amount: number;

  @Column({ type: 'varchar', nullable: true })
  reference: string | null;
}
