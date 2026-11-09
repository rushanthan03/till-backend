import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../database/entities';

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
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

    if (Array.isArray(user.permissions)) {
      user.permissions.forEach(push);
    }

    if (user.role?.name) {
      push(user.role.name);
    }

    return roles;
  }
}
