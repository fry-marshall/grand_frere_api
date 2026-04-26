import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min, Max } from 'class-validator';

export class UpdateDailyLimitDto {
  @ApiProperty({
    description: 'New daily spending limit in XOF',
    minimum: 100,
    maximum: 100000,
  })
  @IsInt()
  @Min(100)
  @Max(100000)
  dailyLimit: number;
}
