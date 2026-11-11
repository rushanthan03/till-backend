import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

/** A supplier of a company (tenant), shared by all of its stores. */
@Entity('suppliers')
@Index(['tenantId', 'name'])
export class Supplier {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column()
  name: string;

  @Column({ type: 'varchar', nullable: true })
  contactName: string | null;

  @Column({ type: 'varchar', nullable: true })
  email: string | null;

  @Column({ type: 'varchar', nullable: true })
  phone: string | null;

  @Column({ type: 'text', nullable: true })
  address: string | null;

  /** Our account number with the supplier. */
  @Column({ type: 'varchar', nullable: true })
  accountNumber: string | null;

  /** Usual days from ordering to delivery; sets the expected date on new orders. */
  @Column({ type: 'int', nullable: true })
  leadTimeDays: number | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
