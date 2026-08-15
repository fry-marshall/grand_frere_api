import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateSchoolDto {
  @ApiPropertyOptional({ example: 'Lycée Moderne de Cocody (Révisé)' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ApiPropertyOptional({ example: '15 Rue des Jardins, Cocody' })
  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(255)
  address?: string;

  @ApiPropertyOptional({
    example: 'Un établissement scolaire au cœur de Cocody...',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}
