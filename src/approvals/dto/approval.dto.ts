import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';

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

export class StaffCredentialsDto {
  @ApiProperty({ example: '1001', required: false, description: 'Employee number (3-8 digits), unique within the company' })
  @IsOptional() @IsString() @Matches(/^\d{3,8}$/, { message: 'Employee number must be 3 to 8 digits' })
  employeeNumber?: string;

  @ApiProperty({ example: '4821', required: false, description: 'Till PIN (4-6 digits)' })
  @IsOptional() @IsString() @Matches(/^\d{4,6}$/, { message: 'PIN must be 4 to 6 digits' })
  pin?: string;
}
