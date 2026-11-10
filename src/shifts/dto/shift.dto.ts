import { IsBoolean, IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { ShiftStatus } from '../../infrastructure/database/entities/shift.entity';
import { CashMovementType } from '../../infrastructure/database/entities/cash-movement.entity';

export class OpenShiftDto {
  @ApiProperty({ description: 'Cash placed in the drawer at the start', example: 100 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  openingFloat: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(250)
  note?: string;
}

export class CountCashDto {
  @ApiProperty({ description: 'Total cash counted in the drawer', example: 338.25 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  countedCash: number;
}

export class CloseShiftDto extends CountCashDto {
  @ApiPropertyOptional({ description: 'Reason for the difference (required when it is larger than the allowed threshold)' })
  @IsOptional()
  @IsString()
  @MaxLength(250)
  note?: string;
}

export class ListShiftsQueryDto {
  @IsOptional() @IsString() storeId?: string;
  @IsOptional() @IsEnum(ShiftStatus) status?: ShiftStatus;
  @IsOptional() @IsString() cashier?: string;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  /** Only closed sessions whose cash count did not match (over or short). */
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  differenceOnly?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) limit?: number;
}

export class CashMovementDto {
  @ApiProperty({ enum: CashMovementType })
  @IsEnum(CashMovementType)
  type: CashMovementType;

  @ApiPropertyOptional({ description: 'Amount (not needed for no_sale)', example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(100000)
  amount?: number;

  @ApiProperty({ description: 'Why the cash moved', example: 'Change from safe' })
  @IsString()
  @MaxLength(150)
  reason: string;

  @ApiPropertyOptional({ description: 'Manager approval token (required from a cashier for paid_out)' })
  @IsOptional()
  @IsString()
  approvalToken?: string;
}

export class DayReportQueryDto {
  @IsOptional() @IsString() storeId?: string;
  @ApiPropertyOptional({ description: 'Trading day, YYYY-MM-DD (default today)' })
  @IsOptional() @IsDateString() date?: string;
}
