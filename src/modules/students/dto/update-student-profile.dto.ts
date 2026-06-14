import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateStudentProfileDto {
  @ApiPropertyOptional({ example: 'Kouassi' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  firstName?: string;

  @ApiPropertyOptional({ example: 'Yao' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  lastName?: string;

  @ApiPropertyOptional({ example: 'CM1' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  class?: string;
}
