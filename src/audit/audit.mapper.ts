import { Injectable } from '@nestjs/common';
import { BaseEntity } from '../infrastructure/database/entities/base.entity';
import { Audit } from './../domain/audit/audit';
import { IMapper } from './../domain/mapper/mapper';
@Injectable()
export class AuditMapper implements IMapper<Audit, BaseEntity> {
  toPersistence(entity: Audit): BaseEntity {
    const model = {
      id: '', // Will be set by the entity
      auditCreatedBy: entity.auditCreatedBy,
      auditCreatedDateTime: new Date(entity.auditCreatedDateTime),
      auditModifiedBy: entity.auditModifiedBy,
      auditModifiedDateTime: entity.auditModifiedDateTime ? new Date(entity.auditModifiedDateTime) : undefined,
      auditDeletedDateTime: entity.auditDeletedDateTime ? new Date(entity.auditDeletedDateTime) : undefined,
      auditDeletedBy: entity.auditDeletedBy,
    };
    return model;
  }

  toDomain(doc: BaseEntity): Audit {
    const entity: Audit = Audit.create({
      auditCreatedBy: doc.auditCreatedBy,
      auditCreatedDateTime: doc.auditCreatedDateTime.toISOString(),
      auditModifiedBy: doc.auditModifiedBy,
      auditModifiedDateTime: doc.auditModifiedDateTime?.toISOString(),
      auditDeletedDateTime: doc.auditDeletedDateTime?.toISOString(),
      auditDeletedBy: doc.auditDeletedBy,
    }).getValue();
    return entity;
  }
}
