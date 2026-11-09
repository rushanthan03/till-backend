import {
  IsString,
  IsEnum,
  IsOptional,
  IsPhoneNumber,
  IsEmail,
  ValidateNested,
  IsNotEmptyObject,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TenantType, TenantStatus, SubscriptionPlan } from '../../infrastructure/database/entities';
import { Type } from 'class-transformer';

class AddressDto {
  @ApiProperty({
    description: 'Lane or street address',
    example: '221B Baker Street',
  })
  @IsString()
  lane: string;

  @ApiProperty({
    description: 'City of the tenant',
    example: 'London',
  })
  @IsString()
  city: string;

  @ApiProperty({
    description: 'District or state of the tenant',
    example: 'Greater London',
  })
  @IsString()
  district: string;

  @ApiProperty({
    description: 'Country of the tenant',
    example: 'United Kingdom',
  })
  @IsString()
  country: string;
}

export class CreateTenantDto {
  @ApiProperty({
    description: 'Tenant display name',
    example: 'Downtown Eats Collective',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Type of tenant organization',
    enum: TenantType,
    example: TenantType.STORE,
  })
  @IsEnum(TenantType)
  type: TenantType;

  @ApiPropertyOptional({
    description: 'Primary tenant contact email',
    example: 'contact@downtowneats.com',
  })
  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @ApiPropertyOptional({
    description: 'Short description of the tenant',
    example: 'Group of restaurants located in the downtown business district.',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Primary phone number for the tenant',
    example: '+94778030468',
  })
  @IsOptional()
  @Matches(/^\+?[1-9]\d{1,14}$/, {
    message: 'contactPhoneNumber must be a valid phone number in E.164 format (e.g., +94778030468)',
  })
  contactPhoneNumber?: string;

  @ApiProperty({
    description: 'Tenant address information',
    type: () => AddressDto,
  })
  @IsNotEmptyObject()
  @ValidateNested()
  @Type(() => AddressDto)
  address: AddressDto;
}

export class UpdateTenantDto {
  @ApiPropertyOptional({
    description: 'Tenant display name',
    example: 'Downtown Eats Collective',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Type of tenant organization',
    enum: TenantType,
    example: TenantType.STORE,
  })
  @IsOptional()
  @IsEnum(TenantType)
  type?: TenantType;

  @ApiPropertyOptional({
    description: 'Tenant operational status',
    enum: TenantStatus,
    example: TenantStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(TenantStatus)
  status?: TenantStatus;

  @ApiPropertyOptional({
    description: 'Assigned subscription plan',
    enum: SubscriptionPlan,
    example: SubscriptionPlan.BASIC,
  })
  @IsOptional()
  @IsEnum(SubscriptionPlan)
  subscriptionPlan?: SubscriptionPlan;

  @ApiPropertyOptional({
    description: 'Primary tenant contact email',
    example: 'contact@downtowneats.com',
  })
  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @ApiPropertyOptional({
    description: 'Short description of the tenant',
    example: 'Group of restaurants located in the downtown business district.',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Primary phone number for the tenant',
    example: '+94778030468',
  })
  @IsOptional()
  @Matches(/^\+?[1-9]\d{1,14}$/, {
    message: 'contactPhoneNumber must be a valid phone number in E.164 format (e.g., +94778030468)',
  })
  contactPhoneNumber?: string;

  @ApiPropertyOptional({
    description: 'Tenant address information',
    type: () => AddressDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  address?: AddressDto;

  @ApiPropertyOptional({
    description: 'Tenant subdomain',
    example: 'downtown-eats',
  })
  @IsOptional()
  @IsString()
  subdomain?: string;

  @ApiPropertyOptional({
    description: 'Tenant logo URL',
    example: 'https://cdn.example.com/logo.png',
  })
  @IsOptional()
  @IsString()
  logo?: string;

  @ApiPropertyOptional({
    description: 'Tenant settings (JSON object)',
    example: {},
  })
  @IsOptional()
  settings?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Billing information (JSON object)',
    example: {},
  })
  @IsOptional()
  billingInfo?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Subscription expiration date',
    example: '2026-12-31',
  })
  @IsOptional()
  @IsString()
  subscriptionExpiresAt?: string;
}
