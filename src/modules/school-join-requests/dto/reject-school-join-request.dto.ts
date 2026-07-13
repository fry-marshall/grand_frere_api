import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RejectSchoolJoinRequestDto {
  @ApiPropertyOptional({
    example: 'Sigle already used by another network member',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
