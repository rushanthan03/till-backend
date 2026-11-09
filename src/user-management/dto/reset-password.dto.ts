import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiPropertyOptional({ description: 'New password to set directly (optional)', example: 'Staff#4829' })
  @IsOptional()
  @IsString()
  @MinLength(6)
  newPassword?: string;

  @ApiPropertyOptional({ description: 'Temporary password alias (optional)', example: 'Staff#4829' })
  @IsOptional()
  @IsString()
  temporaryPassword?: string;

  @ApiPropertyOptional({ description: 'Password alias (optional)', example: 'Staff#4829' })
  @IsOptional()
  @IsString()
  password?: string;
}
