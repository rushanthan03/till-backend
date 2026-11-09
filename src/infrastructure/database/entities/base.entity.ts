import {
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Column,
} from 'typeorm';

export abstract class BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn()
  auditCreatedDateTime: Date;

  @Column()
  auditCreatedBy: string;

  @Column({ nullable: true })
  auditModifiedBy?: string;

  @UpdateDateColumn()
  auditModifiedDateTime?: Date;

  @Column({ nullable: true })
  auditDeletedBy?: string;

  @DeleteDateColumn()
  auditDeletedDateTime?: Date;
}
