import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MinLength } from 'class-validator';

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

  @ApiProperty({ example: 'SecurePass123' })
  @IsString()
  @MinLength(8)
  password: string;
}
