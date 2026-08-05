import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class ApproveSchoolJoinRequestDto {
  @ApiProperty({
    example: 'LMC',
    description: 'Uppercase alphanumeric, 2–10 chars',
  })
  @IsString()
  @Matches(/^[A-Z0-9-]{2,10}$/, {
    message: 'Sigle must be 2–10 uppercase alphanumeric characters',
  })
  sigle: string;
}
