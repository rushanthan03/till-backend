import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Logger, Optional } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../database/entities';
import { PermissionsService } from '../../../permissions/permissions.service';
import { PERMISSIONS_KEY } from '../../../permissions/permissions.decorator';
import { PermissionKey, permissionLabel } from '../../../permissions/permissions';

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);
  constructor(
    private reflector: Reflector,
    @Optional() private readonly permissions?: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if route is public
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);
    
    if (isPublic) {
      return true;
    }

    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    
    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    const normalizedUserRoles = this.extractRoles(user);
    const hasRole = requiredRoles.some((role) => normalizedUserRoles.has(role.toString().toLowerCase()));

    if (!hasRole) {
      this.logger.warn(
        `Insufficient permissions: required [${requiredRoles.join(', ')}] but user has [${Array.from(normalizedUserRoles).join(', ')}]`,
      );
      throw new ForbiddenException('Insufficient permissions');
    }

    // The company can take actions away from managers and cashiers (see PermissionsService).
    const needed = this.reflector.getAllAndOverride<PermissionKey[]>(PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);
    if (needed?.length) {
      if (!this.permissions) throw new ForbiddenException('Permissions are not available');
      const levels = await Promise.all(needed.map((k) => this.permissions!.level(user, k)));
      if (levels.every((l) => l === 'no')) {
        throw new ForbiddenException(`Your role is not allowed to use ${permissionLabel(needed[0]).toLowerCase()}`);
      }
    }

    return true;
  }

  private extractRoles(user: any): Set<string> {
    const roles = new Set<string>();

    const push = (value: unknown) => {
      if (typeof value === 'string' && value.trim().length) {
        roles.add(value.toLowerCase());
      }
    };

    push(user.role);

    if (Array.isArray(user.roles)) {
      user.roles.forEach(push);
    }

    if (user.role?.name) {
      push(user.role.name);
    }

    return roles;
  }
}
