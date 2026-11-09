import { IsBoolean, IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { ShiftStatus } from '../../infrastructure/database/entities/shift.entity';

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
  @IsOptional() @IsString() restaurantId?: string;
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
