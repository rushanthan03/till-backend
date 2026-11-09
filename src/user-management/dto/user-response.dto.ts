import { UserRole, UserStatus, Tenant, Restaurant } from '../../infrastructure/database/entities';

export class UserResponseDto {
  id: string;
  email: string;
  phoneNumber?: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  avatar?: string;
  permissions?: string[];
  lastLoginAt?: Date;
  emailVerifiedAt?: Date;
  phoneVerifiedAt?: Date;
  tenantId?: string;
  tenant?: Tenant;
  restaurantId?: string;
  restaurant?: Restaurant;
  createdAt: Date;
  updatedAt: Date;
}

