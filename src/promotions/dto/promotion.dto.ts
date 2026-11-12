import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { PromotionScope, PromotionType } from '../../infrastructure/database/entities/promotion.entity';

export class CreatePromotionDto {
  @ApiProperty({ example: '3 for £5 Crisps' }) @IsString() @MaxLength(100) name: string;
  @ApiProperty({ enum: PromotionType }) @IsEnum(PromotionType) type: PromotionType;
  @ApiProperty({ enum: PromotionScope }) @IsEnum(PromotionScope) scope: PromotionScope;

  @ApiPropertyOptional({ format: 'uuid', description: 'Required when scope is product' })
  @ValidateIf((o) => o.scope === PromotionScope.PRODUCT) @IsUUID() productId?: string;

  @ApiPropertyOptional({ description: 'Required when scope is department' })
  @ValidateIf((o) => o.scope === PromotionScope.DEPARTMENT) @IsString() @MaxLength(100) department?: string;

  @ApiPropertyOptional({ description: 'Required for percent_off', example: 20 })
  @ValidateIf((o) => o.type === PromotionType.PERCENT_OFF) @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(1) @Max(100) percentOff?: number;

  @ApiPropertyOptional({ description: 'Multibuy: how many make the bundle (2+). Buy-get-free: how many the customer pays for (1+)', example: 3 })
  @ValidateIf((o) => o.type === PromotionType.MULTIBUY || o.type === PromotionType.BUY_GET_FREE) @Type(() => Number) @IsInt() @Min(1) @Max(100) buyQty?: number;

  @ApiPropertyOptional({ description: 'Required for buy_get_free: how many more are free', example: 1 })
  @ValidateIf((o) => o.type === PromotionType.BUY_GET_FREE) @Type(() => Number) @IsInt() @Min(1) @Max(100) freeQty?: number;

  @ApiPropertyOptional({ description: 'Required for multibuy: price for the bundle, VAT included', example: 5 })
  @ValidateIf((o) => o.type === PromotionType.MULTIBUY) @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) bundlePrice?: number;

  @ApiPropertyOptional() @IsOptional() @IsDateString() startsAt?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() endsAt?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdatePromotionDto extends PartialType(CreatePromotionDto) {}

export class ListPromotionsQueryDto {
  @IsOptional() @IsString() storeId?: string;
  /** 'true' = only offers running right now */
  @IsOptional() @IsString() current?: string;
}
