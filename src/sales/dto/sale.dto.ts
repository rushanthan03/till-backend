import { IsDateString } from 'class-validator';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { SalePaymentMethod, SaleStatus } from '../../infrastructure/database/entities/sale.entity';

export class SaleItemInputDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  productId: string;

  @ApiProperty({ description: 'Units, or kg for weighed items', example: 2 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  @Max(100000)
  quantity: number;

  @ApiPropertyOptional({ description: 'Percentage taken off the shelf price (needs manager approval)', example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(100)
  discountPercent?: number;

  @ApiPropertyOptional({ description: 'Replacement unit price, VAT included (needs manager approval)', example: 0.99 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  priceOverride?: number;

  @ApiPropertyOptional({ description: 'Why the price was changed (required with a discount or override)' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}

export class SalePaymentInputDto {
  @ApiProperty({ enum: SalePaymentMethod })
  @IsEnum(SalePaymentMethod)
  method: SalePaymentMethod;

  @ApiProperty({ description: 'Amount applied to the bill', example: 7.35 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  @ApiPropertyOptional({ description: 'Cash handed over (cash only); change = tendered - amount' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  tendered?: number;

  @ApiPropertyOptional({ description: 'Card authorisation reference' })
  @IsOptional()
  @IsString()
  reference?: string;
}

export class CreateSaleDto {
  @ApiProperty({ type: [SaleItemInputDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => SaleItemInputDto)
  items: SaleItemInputDto[];

  @ApiProperty({ type: [SalePaymentInputDto] })
  @IsArray()
  @ArrayMinSize(0)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => SalePaymentInputDto)
  payments: SalePaymentInputDto[];

  @ApiPropertyOptional({ description: 'Cashier confirmed the customer meets the age limit of restricted items' })
  @IsOptional()
  @IsBoolean()
  ageVerified?: boolean;

  @ApiPropertyOptional({ description: 'Unique id made by the till for this sale; resending it returns the same sale (safe retries, offline sync)' })
  @IsOptional() @IsString() @MaxLength(64) clientRef?: string;

  @ApiPropertyOptional({ description: 'When the sale was made, for sales rung up offline (up to 7 days back, never in the future)' })
  @IsOptional() @IsDateString() soldAt?: string;

  @ApiPropertyOptional({ description: 'Loyalty customer to credit with points', format: 'uuid' })
  @IsOptional() @IsUUID() customerId?: string;

  @ApiPropertyOptional({ description: "Loyalty points to spend (100 points = £1 off). Needs customerId; can't be used offline", example: 250 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10000000) redeemPoints?: number;

  @ApiPropertyOptional({ description: 'Token from POST /approvals/verify; required when a cashier applies a discount or price override' })
  @IsOptional()
  @IsString()
  approvalToken?: string;
}

export class ListSalesQueryDto {
  @IsOptional() @IsString() storeId?: string;
  @IsOptional() @IsString() receiptNumber?: string;
  @IsOptional() @IsUUID() shiftId?: string;
  @IsOptional() @IsString() cashier?: string;
  @IsOptional() @IsEnum(SaleStatus) status?: SaleStatus;
  @IsOptional() @IsEnum(SalePaymentMethod) method?: SalePaymentMethod;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) limit?: number;
}
