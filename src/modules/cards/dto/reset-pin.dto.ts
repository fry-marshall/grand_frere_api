import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, Matches } from 'class-validator';

export class ResetPinDto {
  @ApiProperty({ description: 'Current account password' })
  @IsString()
  @MinLength(1)
  password: string;

  @ApiProperty({ description: 'New 4-digit PIN', example: '5678' })
  @IsString()
  @Matches(/^\d{4}$/, { message: 'PIN must be exactly 4 digits' })
  newPin: string;
}
