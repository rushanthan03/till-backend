import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * One line per sensitive action (sign-ins, price changes, refunds, drawer openings, permission changes…).
 * Written once and never changed: there is no update or delete endpoint.
 */
@Entity('audit_logs')
@Index('IDX_audit_logs_tenant_created', ['tenantId', 'createdAt'])
@Index('IDX_audit_logs_store_created', ['storeId', 'createdAt'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  tenantId: string | null;

  /** Null for company-wide actions (staff, permissions). */
  @Column({ type: 'uuid', nullable: true })
  storeId: string | null;

  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  userName: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  userRole: string | null;

  /** e.g. "refund", "product.price", "drawer.no_sale". */
  @Column({ type: 'varchar', length: 60 })
  action: string;

  @Column({ type: 'varchar', length: 40, nullable: true })
  entityType: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  entityId: string | null;

  @Column({ type: 'varchar', length: 500 })
  summary: string;

  @Column({ type: 'jsonb', nullable: true })
  details: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;
}
