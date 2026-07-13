import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateSchoolActivityDto {
  @ApiPropertyOptional({ example: 'Journée sportive (mise à jour)' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({ example: 'Description mise à jour.' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  description?: string;
}
