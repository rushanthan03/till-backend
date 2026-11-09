import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { UserRole } from '../database/entities';

/**
 * Resolves which store (restaurantId) a request may act on:
 *  - super admin must name the store
 *  - tenant admin uses their assigned store, or the one named
 *  - everyone else is locked to their own store
 */
export function resolveStoreId(restaurantId: string | undefined, user: any): string {
  if (user.role === UserRole.SUPER_ADMIN) {
    if (!restaurantId) throw new BadRequestException('restaurantId is required for super admin');
    return restaurantId;
  }
  if (user.role === UserRole.TENANT_ADMIN) {
    const id = user.restaurantId || restaurantId;
    if (!id) throw new BadRequestException('restaurantId is required');
    return id;
  }
  if (!user.restaurantId) throw new ForbiddenException('User is not assigned to a store');
  if (restaurantId && restaurantId !== user.restaurantId) {
    throw new ForbiddenException('You can only access data for your own store');
  }
  return user.restaurantId;
}
