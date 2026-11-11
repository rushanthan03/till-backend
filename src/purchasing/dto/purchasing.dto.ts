import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsDateString, IsEmail, IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength, ValidateNested,
} from 'class-validator';
import { PurchaseOrderStatus } from '../../infrastructure/database/entities/purchase-order.entity';

export class CreateSupplierDto {
  @ApiProperty({ example: 'Booker Wholesale' }) @IsString() @MinLength(1) @MaxLength(100) name: string;
  @ApiPropertyOptional({ example: 'Sam Patel' }) @IsOptional() @IsString() @MaxLength(100) contactName?: string;
  @ApiPropertyOptional({ example: 'orders@booker.test' }) @IsOptional() @IsEmail() @MaxLength(150) email?: string;
  @ApiPropertyOptional({ example: '0113 496 0000' }) @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) address?: string;
  @ApiPropertyOptional({ example: 'FM-10442' }) @IsOptional() @IsString() @MaxLength(60) accountNumber?: string;
  @ApiPropertyOptional({ example: 2 }) @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(120) leadTimeDays?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) notes?: string;
  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateSupplierDto extends PartialType(CreateSupplierDto) {}

export class ListSuppliersQueryDto {
  @IsOptional() @IsString() storeId?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() status?: 'active' | 'inactive' | 'all';
}

export class PoLineDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() productId: string;

  @ApiProperty({ example: 24 })
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 3 }) @Min(0.001) @Max(100000)
  quantity: number;

  @ApiPropertyOptional({ description: 'Cost per unit ex VAT; defaults to the product cost price', example: 0.85 })
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100000)
  unitCost?: number;
}

export class CreatePurchaseOrderDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() supplierId: string;
  @ApiPropertyOptional({ example: '2026-11-14' }) @IsOptional() @IsDateString() expectedDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) notes?: string;

  @ApiProperty({ type: [PoLineDto] })
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(500) @ValidateNested({ each: true }) @Type(() => PoLineDto)
  lines: PoLineDto[];

  @ApiPropertyOptional({ description: 'true = mark as ordered straight away instead of saving a draft' })
  @IsOptional() @IsBoolean() submit?: boolean;
}

export class UpdatePurchaseOrderDto extends PartialType(CreatePurchaseOrderDto) {}

export class ReceiveLineDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() lineId: string;

  @ApiProperty({ description: 'Quantity that arrived in this delivery', example: 12 })
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 3 }) @Min(0) @Max(100000)
  quantity: number;

  @ApiPropertyOptional({ description: 'Cost per unit on the invoice, if different', example: 0.82 })
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100000)
  unitCost?: number;
}

export class ReceivePurchaseOrderDto {
  @ApiPropertyOptional({ description: 'Delivery note or invoice number', example: 'DN-20418' })
  @IsOptional() @IsString() @MaxLength(60) deliveryNote?: string;

  @ApiPropertyOptional({ description: 'Update product cost prices to the delivered cost (default true)' })
  @IsOptional() @IsBoolean() updateCostPrices?: boolean;

  @ApiProperty({ type: [ReceiveLineDto] })
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(500) @ValidateNested({ each: true }) @Type(() => ReceiveLineDto)
  lines: ReceiveLineDto[];
}

export class ListPurchaseOrdersQueryDto {
  @IsOptional() @IsString() storeId?: string;
  @IsOptional() @IsEnum(PurchaseOrderStatus) status?: PurchaseOrderStatus;
  @IsOptional() @IsString() open?: string;
  @IsOptional() @IsUUID() supplierId?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) limit?: number;
}

export class SuggestionsQueryDto {
  @IsOptional() @IsString() storeId?: string;
  @IsOptional() @IsUUID() supplierId?: string;
}
