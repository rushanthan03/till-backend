import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, ManyToOne, JoinColumn, ValueTransformer } from 'typeorm';
import { Restaurant } from './restaurant.entity';

const decimalTransformer: ValueTransformer = {
  to: (value?: number | null) => value,
  from: (value?: string | null) => (value === null || value === undefined ? value : parseFloat(value)),
};

export enum ShiftStatus {
  OPEN = 'open',
  CLOSED = 'closed',
}

/**
 * One cashier's till session. The Z-report figures are copied onto the row when the
 * shift closes, so a closed shift never changes afterwards.
 */
@Entity('shifts')
@Index(['storeId', 'openedAt'])
// A cashier can only have one open shift per store at a time.
@Index('UQ_shifts_one_open_per_user', ['storeId', 'userId'], { unique: true, where: `"status" = 'open'` })
export class Shift {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'restaurantId' })
  storeId: string;

  @ManyToOne(() => Restaurant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'restaurantId' })
  restaurant: Restaurant;

  @Column({ type: 'uuid' })
  userId: string;

  @Column()
  cashierName: string;

  @Column({ type: 'enum', enum: ShiftStatus, default: ShiftStatus.OPEN })
  status: ShiftStatus;

  @CreateDateColumn()
  openedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  closedAt: Date | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, transformer: decimalTransformer })
  openingFloat: number;

  @Column({ type: 'varchar', nullable: true })
  openingNote: string | null;

  // ---- filled in at close (Z report) ----
  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true, transformer: decimalTransformer })
  countedCash: number | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true, transformer: decimalTransformer })
  expectedCash: number | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true, transformer: decimalTransformer })
  variance: number | null;

  @Column({ type: 'varchar', nullable: true })
  closeNote: string | null;

  @Column({ type: 'int', nullable: true })
  transactionCount: number | null;

  @Column({ type: 'int', nullable: true })
  refundCount: number | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true, transformer: decimalTransformer })
  grossSales: number | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true, transformer: decimalTransformer })
  vatTotal: number | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true, transformer: decimalTransformer })
  cashSales: number | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true, transformer: decimalTransformer })
  cardSales: number | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true, transformer: decimalTransformer })
  refundsTotal: number | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true, transformer: decimalTransformer })
  cashRefunds: number | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true, transformer: decimalTransformer })
  cardRefunds: number | null;
}
