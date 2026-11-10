import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

const PIN_RULE = /^\d{4,6}$/;

export class VerifyPinDto {
  @ApiProperty({ example: '1234', description: "A manager's 4-6 digit approval PIN" })
  @IsString()
  @Matches(PIN_RULE, { message: 'PIN must be 4 to 6 digits' })
  pin: string;
}

export class SetPinDto {
  @ApiProperty({ example: '2580', description: 'New 4-6 digit approval PIN' })
  @IsString()
  @Matches(PIN_RULE, { message: 'PIN must be 4 to 6 digits' })
  pin: string;
}
