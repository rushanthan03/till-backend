import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, ValueTransformer } from 'typeorm';

const decimalTransformer: ValueTransformer = {
  to: (value?: number | null) => value,
  from: (value?: string | null) => (value === null || value === undefined ? value : parseFloat(value)),
};

export enum CardChargeStatus {
  APPROVED = 'approved',
  DECLINED = 'declined',
}

/**
 * Every attempt to take a card payment on the terminal. A sale can only list a card payment that has an
 * approved charge here, so a cashier cannot record a card payment the customer never made.
 */
@Entity('card_charges')
@Index(['storeId', 'reference'], { unique: true })
@Index('UQ_card_charges_client_ref', ['storeId', 'clientRef'], { unique: true })
export class CardCharge {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  storeId: string;

  @Column()
  provider: string;

  /** Terminal / acquirer reference; the card payment on the sale carries it. */
  @Column()
  reference: string;

  /** Id the till made for this attempt; resending it returns the same result instead of charging again. */
  @Column()
  clientRef: string;

  @Column({ type: 'enum', enum: CardChargeStatus })
  status: CardChargeStatus;

  @Column({ type: 'decimal', precision: 12, scale: 2, transformer: decimalTransformer })
  amount: number;

  @Column({ type: 'varchar', nullable: true })
  scheme: string | null;

  @Column({ type: 'varchar', nullable: true })
  last4: string | null;

  @Column({ type: 'varchar', nullable: true })
  authCode: string | null;

  @Column({ type: 'varchar', nullable: true })
  declineReason: string | null;

  /** The sale this approved charge paid for (null until the sale is saved). */
  @Column({ type: 'uuid', nullable: true })
  saleId: string | null;

  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
