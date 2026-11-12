import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class ListAuditQueryDto {
  @IsOptional() @IsUUID() storeId?: string;
  @IsOptional() @IsUUID() userId?: string;
  /** Action group, e.g. "refund" or "product". */
  @IsOptional() @IsString() group?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(1000) limit?: number;
}
