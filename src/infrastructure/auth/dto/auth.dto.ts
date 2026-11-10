import { IsEmail, IsString, IsOptional, IsEnum, IsPhoneNumber, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../../database/entities';

export class LoginDto {
  @ApiProperty({ example: 'admin@till.local', description: 'Registered email address' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'StrongPassw0rd!', description: 'Account password' })
  @IsString()
  password: string;
}

export class PinLoginDto {
  @ApiProperty({ description: 'Company id this till belongs to (remembered after the first email sign-in)' })
  @IsString()
  tenantId: string;

  @ApiProperty({ example: '1001', description: "The member of staff's employee number" })
  @IsString()
  @Matches(/^\d{3,8}$/, { message: 'Employee number must be 3 to 8 digits' })
  employeeNumber: string;

  @ApiProperty({ example: '1234', description: '4 to 6 digit PIN' })
  @IsString()
  @Matches(/^\d{4,6}$/, { message: 'PIN must be 4 to 6 digits' })
  pin: string;
}

export class RegisterDto {
  @ApiProperty({ example: 'newuser@restflow.com', description: 'Unique email for the new account' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'StrongPassw0rd!', description: 'Password for the new account' })
  @IsString()
  password: string;

  @ApiProperty({ example: 'John Doe', description: 'Display name for the user' })
  @IsString()
  name: string;

  @ApiProperty({ enum: UserRole, example: UserRole.MANAGER, description: 'Role assigned to the user' })
  @IsEnum(UserRole)
  role: UserRole;

  @ApiPropertyOptional({ format: 'uuid', description: 'Tenant identifier the user belongs to' })
  @IsString()
  tenantId?: string;

  @ApiPropertyOptional({ example: '+15555550123', description: 'Contact phone number' })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Restaurant identifier if applicable' })
  @IsOptional()
  @IsString()
  restaurantId?: string;
}

export class RefreshTokenDto {
  @ApiProperty({ description: 'Valid refresh token issued during login' })
  @IsString()
  refreshToken: string;
}

export class ChangePasswordDto {
  @ApiProperty({ description: 'Current password for the account' })
  @IsString()
  currentPassword: string;

  @ApiProperty({ description: 'New password to be set for the account' })
  @IsString()
  newPassword: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'user@till.local', description: 'Email address to send the password reset link' })
  @IsEmail()
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty({ description: 'Token received via password reset email' })
  @IsString()
  token: string;

  @ApiProperty({ description: 'New password to assign to the account' })
  @IsString()
  newPassword: string;
}
