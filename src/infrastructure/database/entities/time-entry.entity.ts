import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

/** One stretch of work: clocked in, then clocked out (null while the person is still on the clock). */
@Entity('time_entries')
@Index(['storeId', 'clockedInAt'])
@Index(['userId', 'clockedInAt'])
export class TimeEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  storeId: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column()
  userName: string;

  @Column({ type: 'timestamp' })
  clockedInAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  clockedOutAt: Date | null;

  /** e.g. "Auto-closed after 16 hours" when someone forgot to clock out. */
  @Column({ type: 'varchar', nullable: true })
  note: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
