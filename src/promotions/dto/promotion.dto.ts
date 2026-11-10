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

  @ApiPropertyOptional({ description: 'Required for multibuy: how many to buy', example: 3 })
  @ValidateIf((o) => o.type === PromotionType.MULTIBUY) @Type(() => Number) @IsInt() @Min(2) @Max(100) buyQty?: number;

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
