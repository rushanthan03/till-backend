import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, ManyToOne, OneToMany, JoinColumn, ValueTransformer } from 'typeorm';
import { Supplier } from './supplier.entity';

const decimalTransformer: ValueTransformer = {
  to: (value?: number | null) => value,
  from: (value?: string | null) => (value === null || value === undefined ? value : parseFloat(value)),
};

export enum PurchaseOrderStatus {
  DRAFT = 'draft',
  ORDERED = 'ordered',
  PARTIAL = 'partial',
  RECEIVED = 'received',
  CANCELLED = 'cancelled',
}

/** An order to a supplier for one store. Draft -> ordered -> (partly) received; or cancelled. */
@Entity('purchase_orders')
@Index(['storeId', 'seq'], { unique: true })
@Index(['storeId', 'status'])
@Index(['supplierId'])
export class PurchaseOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  storeId: string;

  @Column({ type: 'uuid' })
  supplierId: string;

  @ManyToOne(() => Supplier)
  @JoinColumn({ name: 'supplierId' })
  supplier: Supplier;

  /** Per-store running number behind `number` (PO-000001). */
  @Column({ type: 'int' })
  seq: number;

  @Column()
  number: string;

  @Column({ type: 'enum', enum: PurchaseOrderStatus, default: PurchaseOrderStatus.DRAFT })
  status: PurchaseOrderStatus;

  @Column({ type: 'date', nullable: true })
  expectedDate: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  /** Ordered cost, ex VAT. */
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, transformer: decimalTransformer })
  totalCost: number;

  /** Cost of what has arrived so far, ex VAT. */
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, transformer: decimalTransformer })
  receivedCost: number;

  @Column({ type: 'uuid', nullable: true })
  createdById: string | null;

  @Column({ type: 'varchar', nullable: true })
  createdByName: string | null;

  @Column({ type: 'timestamp', nullable: true })
  orderedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  closedAt: Date | null;

  @OneToMany(() => PurchaseOrderLine, (l) => l.order, { cascade: ['insert'] })
  lines: PurchaseOrderLine[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('purchase_order_lines')
@Index(['purchaseOrderId'])
export class PurchaseOrderLine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  purchaseOrderId: string;

  @ManyToOne(() => PurchaseOrder, (o) => o.lines, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'purchaseOrderId' })
  order: PurchaseOrder;

  @Column({ type: 'uuid' })
  productId: string;

  @Column()
  productName: string;

  @Column()
  barcode: string;

  @Column({ type: 'decimal', precision: 12, scale: 3, transformer: decimalTransformer })
  quantity: number;

  /** Cost per unit ex VAT. */
  @Column({ type: 'decimal', precision: 10, scale: 2, transformer: decimalTransformer })
  unitCost: number;

  @Column({ type: 'decimal', precision: 12, scale: 3, default: 0, transformer: decimalTransformer })
  receivedQuantity: number;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;
}
