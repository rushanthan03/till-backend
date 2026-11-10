import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsDateString, IsEnum, IsInt, IsIn, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { StockMovementType } from '../../infrastructure/database/entities/stock-movement.entity';

export class ReceiptLineDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() productId: string;

  @ApiProperty({ description: 'Quantity delivered', example: 24 })
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 3 }) @Min(0.001) @Max(100000)
  quantity: number;

  @ApiPropertyOptional({ description: 'Unit cost price from the delivery note (updates the product cost)', example: 0.85 })
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100000)
  costPrice?: number;
}

export class GoodsReceiptDto {
  @ApiPropertyOptional({ example: 'Booker Wholesale' }) @IsOptional() @IsString() @MaxLength(100) supplier?: string;
  @ApiPropertyOptional({ description: 'Delivery note or invoice number', example: 'DN-20418' }) @IsOptional() @IsString() @MaxLength(60) reference?: string;

  @ApiProperty({ type: [ReceiptLineDto] })
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(500) @ValidateNested({ each: true }) @Type(() => ReceiptLineDto)
  lines: ReceiptLineDto[];
}

export class AdjustStockDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() productId: string;

  @ApiProperty({ enum: [StockMovementType.ADJUSTMENT, StockMovementType.WASTE, StockMovementType.DAMAGED, StockMovementType.EXPIRED] })
  @IsIn([StockMovementType.ADJUSTMENT, StockMovementType.WASTE, StockMovementType.DAMAGED, StockMovementType.EXPIRED])
  type: StockMovementType;

  @ApiProperty({ description: 'Waste/damaged/expired: units removed (positive). Adjustment: signed change, e.g. -3 or 5', example: 3 })
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 3 })
  quantity: number;

  @ApiProperty({ example: 'Dropped in aisle 4' }) @IsString() @MaxLength(150) reason: string;
}

export class StocktakeLineDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() productId: string;

  @ApiProperty({ description: 'What was physically counted', example: 18 })
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 3 }) @Min(0) @Max(1000000)
  counted: number;
}

export class StocktakeDto {
  @ApiPropertyOptional({ example: 'Aisle 3 count' }) @IsOptional() @IsString() @MaxLength(100) name?: string;

  @ApiProperty({ type: [StocktakeLineDto] })
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(1000) @ValidateNested({ each: true }) @Type(() => StocktakeLineDto)
  lines: StocktakeLineDto[];
}

export class ListMovementsQueryDto {
  @IsOptional() @IsString() storeId?: string;
  @IsOptional() @IsUUID() productId?: string;
  @IsOptional() @IsEnum(StockMovementType) type?: StockMovementType;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) limit?: number;
}
