import { IsOptional, IsInt, Min, Max, IsString, IsEnum, IsIn } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export enum SortOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}

export class EnhancedPaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Transform(({ value }) => parseInt(value))
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @Transform(({ value }) => parseInt(value))
  limit?: number = 10;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  sortBy?: string;

  @IsOptional()
  @IsEnum(SortOrder)
  @IsIn([SortOrder.ASC, SortOrder.DESC])
  sortOrder?: SortOrder = SortOrder.DESC;

  // Restaurant-specific filters
  @IsOptional()
  @IsString()
  tenantId?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  district?: string;

  @IsOptional()
  @IsString()
  @IsIn(['active', 'inactive'])
  status?: string;

  // Subscription filters
  @IsOptional()
  @IsString()
  planId?: string;

  @IsOptional()
  @IsString()
  planCode?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  isOverLimit?: boolean;

  // Wallet filters
  @IsOptional()
  @Type(() => Number)
  @Transform(({ value }) => parseFloat(value))
  minWalletBalance?: number;

  @IsOptional()
  @Type(() => Number)
  @Transform(({ value }) => parseFloat(value))
  maxWalletBalance?: number;

  // Allow additional dynamic filter fields
  // Menu-specific filters
  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  isAvailable?: boolean;

  [key: string]: any;
}

export interface PaginationResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

