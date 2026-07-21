import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateDailyLimitPermissionDto {
  @ApiProperty({
    description:
      'Whether the student is allowed to edit their own daily spending limit',
  })
  @IsBoolean()
  studentCanEditDailyLimit: boolean;
}
