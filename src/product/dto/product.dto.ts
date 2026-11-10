import { IsString, IsOptional, IsBoolean, IsNumber, IsInt, IsEnum, Min, Max, MinLength, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ProductUnitType } from '../../infrastructure/database/entities/product.entity';

export class CreateProductDto {
  @ApiProperty({ example: 'Whole Milk 2L' })
  @IsString()
  @MinLength(1)
  name: string;

  @ApiProperty({ description: 'Barcode (EAN-13/EAN-8/UPC) - unique within a store', example: '5000000000017' })
  @IsString()
  @Matches(/^[A-Za-z0-9-]{3,32}$/, { message: 'Barcode must be 3-32 letters, digits or dashes' })
  barcode: string;

  @ApiPropertyOptional({ example: 'DAI-0001' })
  @IsOptional()
  @IsString()
  sku?: string;

  @ApiProperty({ example: 'Dairy & Eggs' })
  @IsString()
  @MinLength(1)
  department: string;

  @ApiPropertyOptional({ example: 'Milk' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ example: 'Farm Fresh' })
  @IsOptional()
  @IsString()
  brand?: string;

  @ApiPropertyOptional({ enum: ProductUnitType, default: ProductUnitType.EACH })
  @IsOptional()
  @IsEnum(ProductUnitType)
  unitType?: ProductUnitType;

  @ApiProperty({ description: 'Shelf price including VAT (price per kg for weighed items)', example: 1.65 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price: number;

  @ApiPropertyOptional({ example: 1.1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  costPrice?: number;

  @ApiPropertyOptional({ description: 'VAT percentage', example: 20, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  vatRate?: number;

  @ApiPropertyOptional({ description: 'Minimum legal age (0 = none)', example: 18, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(99)
  ageRestriction?: number;

  @ApiPropertyOptional({ example: 24 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  stockQuantity?: number;

  @ApiPropertyOptional({ example: 6 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  reorderLevel?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateProductDto extends PartialType(CreateProductDto) {}

export class ListProductsQueryDto {
  @IsOptional() @IsString() storeId?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() department?: string;
  @IsOptional() @IsString() status?: 'active' | 'inactive' | 'all';
  @IsOptional() @IsString() lowStock?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) limit?: number;
}
