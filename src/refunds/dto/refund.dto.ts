import { ArrayMaxSize, ArrayMinSize, IsArray, IsEnum, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { RefundDisposition, RefundReason } from '../../infrastructure/database/entities/refund.entity';
import { SalePaymentMethod } from '../../infrastructure/database/entities/sale.entity';

export class RefundItemInputDto {
  @ApiProperty({ format: 'uuid', description: 'The sale line being refunded' })
  @IsUUID()
  saleItemId: string;

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  quantity: number;

  @ApiProperty({ enum: RefundDisposition, description: 'What happens to the returned goods' })
  @IsEnum(RefundDisposition)
  disposition: RefundDisposition;
}

export class RefundPaymentInputDto {
  @ApiProperty({ enum: SalePaymentMethod })
  @IsEnum(SalePaymentMethod)
  method: SalePaymentMethod;

  @ApiProperty({ example: 4.65 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  @ApiPropertyOptional({ description: 'Card terminal reference for a card refund' })
  @IsOptional()
  @IsString()
  reference?: string;
}

export class CreateRefundDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  saleId: string;

  @ApiProperty({ type: [RefundItemInputDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => RefundItemInputDto)
  items: RefundItemInputDto[];

  @ApiProperty({ enum: RefundReason })
  @IsEnum(RefundReason)
  reason: RefundReason;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(250)
  note?: string;

  @ApiProperty({ type: [RefundPaymentInputDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => RefundPaymentInputDto)
  payments: RefundPaymentInputDto[];
}
