import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class ChargeDto {
  @ApiProperty({ example: 12.5, description: 'Amount to take on the card' })
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Max(10000)
  amount: number;

  @ApiProperty({ description: 'Id the till made for this attempt. Resending it returns the same result and never charges twice.' })
  @IsString() @MaxLength(64)
  clientRef: string;

  @ApiPropertyOptional({ enum: ['decline'], description: 'Simulated terminal only: force a decline (demos)' })
  @IsOptional() @IsIn(['decline'])
  simulate?: 'decline';
}
