import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsEmail, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

export class CreateCustomerDto {
  @ApiProperty({ example: 'Amy Patel' }) @IsString() @MaxLength(100) name: string;

  @ApiPropertyOptional({ example: '07700900123' })
  @IsOptional() @IsString() @Matches(/^[0-9+()\s-]{7,20}$/, { message: 'Enter a valid phone number' }) phone?: string;

  @ApiPropertyOptional() @IsOptional() @IsEmail() email?: string;

  @ApiPropertyOptional({ description: 'Customer agreed to marketing. Must be an explicit opt-in.' })
  @IsOptional() @IsBoolean() marketingConsent?: boolean;
}

export class UpdateCustomerDto extends PartialType(CreateCustomerDto) {
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class ListCustomersQueryDto {
  @IsOptional() @IsString() storeId?: string;
  @ApiPropertyOptional({ description: 'Name, phone, email or card number' }) @IsOptional() @IsString() search?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}
