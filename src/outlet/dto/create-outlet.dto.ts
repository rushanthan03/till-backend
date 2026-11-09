import { IsString, IsOptional, IsObject, IsEmail, ValidateNested, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class StoreAddressDto {
  @ApiPropertyOptional({ description: 'Street address', example: '42 High Street' })
  @IsOptional()
  @IsString()
  lane?: string;

  @ApiPropertyOptional({ description: 'City / town', example: 'Leeds' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ description: 'County / region', example: 'West Yorkshire' })
  @IsOptional()
  @IsString()
  district?: string;

  @ApiPropertyOptional({ description: 'Country', example: 'United Kingdom' })
  @IsOptional()
  @IsString()
  country?: string;
}

export class CreateOutletDto {
  @ApiProperty({ description: 'Store name', example: 'Fresh Market - High Street' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ description: 'Store address', type: () => StoreAddressDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => StoreAddressDto)
  address?: StoreAddressDto;

  @ApiPropertyOptional({ description: 'Logo URL' })
  @IsOptional()
  @IsString()
  logo?: string;

  @ApiPropertyOptional({ description: 'Store contact email' })
  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @ApiPropertyOptional({ description: 'Store contact phone number' })
  @IsOptional()
  @IsString()
  contactPhoneNumber?: string;

  @ApiPropertyOptional({ example: '08:00', description: 'Opening time (HH:MM)' })
  @IsOptional()
  @IsString()
  openTime?: string;

  @ApiPropertyOptional({ example: '22:00', description: 'Closing time (HH:MM)' })
  @IsOptional()
  @IsString()
  closeTime?: string;

  @ApiPropertyOptional({ description: 'Opening hours per day of the week' })
  @IsOptional()
  @IsObject()
  openHours?: Record<string, any>;
}
