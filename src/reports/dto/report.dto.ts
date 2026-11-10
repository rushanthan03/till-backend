import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ReportQueryDto {
  @IsOptional() @IsString() storeId?: string;
  @ApiPropertyOptional({ description: 'Start of the period (ISO). Omit for all time.' }) @IsOptional() @IsDateString() from?: string;
  @ApiPropertyOptional({ description: 'End of the period (ISO). Omit for now.' }) @IsOptional() @IsDateString() to?: string;
}

export class ProductReportQueryDto extends ReportQueryDto {
  @ApiPropertyOptional({ enum: ['revenue', 'quantity', 'margin'] }) @IsOptional() @IsIn(['revenue', 'quantity', 'margin']) sort?: 'revenue' | 'quantity' | 'margin';
  @ApiPropertyOptional({ description: 'Rows to return (default 20)' }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) limit?: number;
}
