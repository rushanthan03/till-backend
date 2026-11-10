import { ApiProperty } from '@nestjs/swagger';
import { UserRole, UserStatus } from '../../database/entities';

export class UserResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;
  @ApiProperty({ example: 'user@till.local' })
  email: string;
  @ApiProperty({ example: '+15555550123', required: false })
  phoneNumber?: string;
  @ApiProperty({ example: 'John Doe' })
  name: string;
  @ApiProperty({ enum: UserRole, example: UserRole.MANAGER })
  role: UserRole;
  @ApiProperty({ enum: UserStatus, example: UserStatus.ACTIVE })
  status: UserStatus;
  @ApiProperty({ required: false })
  avatar?: string;
  @ApiProperty({ format: 'uuid', required: false })
  tenantId?: string;
  @ApiProperty({ required: false, type: String, format: 'date-time' })
  lastLoginAt?: Date;
  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;
  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: Date;
}

export class AuthResponseDto {
  @ApiProperty({ type: () => UserResponseDto })
  user: UserResponseDto;
  @ApiProperty({ description: 'JWT access token' })
  accessToken: string;
  @ApiProperty({ description: 'JWT refresh token' })
  refreshToken: string;
  @ApiProperty({ description: 'Access token lifetime in seconds', example: 900 })
  expiresIn: number;
}

export class TokenResponseDto {
  @ApiProperty({ description: 'Refreshed access token' })
  accessToken: string;
  @ApiProperty({ description: 'Refreshed refresh token' })
  refreshToken: string;
  @ApiProperty({ description: 'Access token lifetime in seconds', example: 900 })
  expiresIn: number;
}
