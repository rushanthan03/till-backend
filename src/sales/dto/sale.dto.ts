import { IsDateString } from 'class-validator';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID, Max, Min, ValidateNested } from 'class-validator';
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
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => SalePaymentInputDto)
  payments: SalePaymentInputDto[];

  @ApiPropertyOptional({ description: 'Cashier confirmed the customer meets the age limit of restricted items' })
  @IsOptional()
  @IsBoolean()
  ageVerified?: boolean;
}

export class ListSalesQueryDto {
  @IsOptional() @IsString() restaurantId?: string;
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
