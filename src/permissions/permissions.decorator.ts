import { SetMetadata } from '@nestjs/common';
import { PermissionKey } from './permissions';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Managers and cashiers also need one of these permissions (anything but "not allowed").
 * Admins always pass. Works with RolesGuard, which checks it after the role.
 */
export const NeedsPermission = (...keys: PermissionKey[]) => SetMetadata(PERMISSIONS_KEY, keys);
