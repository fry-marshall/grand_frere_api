import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class VerifyPinDto {
  @ApiProperty({ description: '4-digit PIN', example: '1234' })
  @IsString()
  @Matches(/^\d{4}$/, { message: 'PIN must be exactly 4 digits' })
  pin: string;
}
