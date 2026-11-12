import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Restaurant, Tenant, User } from '../infrastructure/database/entities';
import { AuditLog } from '../infrastructure/database/entities/audit-log.entity';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditLogController } from '../audit-log/audit-log.controller';
import { PermissionsService } from './permissions.service';
import { PermissionsController } from './permissions.controller';

/** Global so every module's RolesGuard can check permissions and every service can write to the audit log. */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Tenant, User, Restaurant, AuditLog])],
  controllers: [PermissionsController, AuditLogController],
  providers: [PermissionsService, AuditLogService],
  exports: [PermissionsService, AuditLogService],
})
export class PermissionsModule {}
