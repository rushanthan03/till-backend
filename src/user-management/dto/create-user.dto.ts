import { IsString, IsEnum, IsOptional, IsEmail } from 'class-validator';
import { UserRole } from '../../infrastructure/database/entities';

export class CreateUserDto {
  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  password: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsEnum(UserRole)
  role: UserRole;

  @IsOptional()
  @IsString()
  restaurantId?: string;
}
