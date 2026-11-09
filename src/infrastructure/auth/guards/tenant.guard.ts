import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { UserRole } from '../../database/entities';

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const tenantId = request.headers['x-tenant-id'] || request.params.tenantId;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Super admin can access any tenant
    if (user.role === UserRole.SUPER_ADMIN) {
      return true;
    }

    // Other users must belong to the tenant
    if (!user.tenantId || user.tenantId !== tenantId) {
      throw new ForbiddenException('Access denied to this tenant');
    }

    return true;
  }
}
