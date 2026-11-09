import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  IsNumber,
  IsArray,
  IsUUID,
  ValidateNested,
  IsEnum,
  IsIn,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';


class RestaurantAddressDto {
  @ApiPropertyOptional({ description: 'Lane or street address', example: '42 Elm Street' })
  @IsOptional()
  @IsString()
  lane?: string;

  @ApiPropertyOptional({ description: 'City where the store is located', example: 'New York' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ description: 'District or state of the store', example: 'Manhattan' })
  @IsOptional()
  @IsString()
  district?: string;

  @ApiPropertyOptional({ description: 'Country of the store', example: 'USA' })
  @IsOptional()
  @IsString()
  country?: string;
}
export class CreateRestaurantDTO {
  @ApiProperty({ example: 'Fresh Market High Street', description: 'Display name of the store' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  readonly name: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Tenant identifier the store belongs to' })
  @IsUUID()
  @IsOptional()
  readonly tenantId?: string;

  @ApiPropertyOptional({ description: 'URL or path for the store logo' })
  @IsString()
  @MaxLength(256)
  @IsOptional()
  readonly logo?: string;

  @ApiPropertyOptional({ description: 'Structured address information for the store', type: () => RestaurantAddressDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => RestaurantAddressDto)
  readonly address?: RestaurantAddressDto;

  @ApiPropertyOptional({ example: 'info@freshmarket.com', description: 'Contact email' })
  @IsString()
  @MaxLength(256)
  @IsOptional()
  @IsEmail()
  readonly contactEmail?: string;

  @ApiPropertyOptional({ example: '+15555550123', description: 'Contact phone number' })
  @IsString()
  @MaxLength(256)
  @IsOptional()
  readonly contactPhoneNumber?: string;

  @ApiPropertyOptional({ example: '09:00', description: 'Opening time (HH:MM)' })
  @IsString()
  @MaxLength(10)
  @IsOptional()
  readonly openTime?: string; // e.g., "09:00"

  @ApiPropertyOptional({ example: '22:00', description: 'Closing time (HH:MM)' })
  @IsString()
  @MaxLength(10)
  @IsOptional()
  readonly closeTime?: string; // e.g., "22:00"

  @ApiPropertyOptional({
    description: 'Custom operating hours per day of week',
    example: { Monday: '09:00-22:00', Tuesday: '09:00-22:00' },
  })
  @IsObject()
  @IsOptional()
  readonly openHours?: Record<string, string>; // e.g., { "mon-fri": "10:00-22:00", "sat-sun": "09:00-23:00" }

  @ApiPropertyOptional({ default: true, description: 'Whether the store is active' })
  @IsBoolean()
  @IsOptional()
  readonly isActive?: boolean;

  @ApiPropertyOptional({ example: '#FFFFFF', description: 'Primary brand color' })
  @IsString()
  @IsOptional()
  readonly primaryColor?: string;

  @ApiPropertyOptional({ example: '#000000', description: 'Secondary brand color' })
  @IsString()
  @IsOptional()
  readonly secondaryColor?: string;

  @ApiPropertyOptional({ example: '#F0F0F0', description: 'Tertiary brand color' })
  @IsString()
  @IsOptional()
  readonly tertiaryColor?: string;
}
