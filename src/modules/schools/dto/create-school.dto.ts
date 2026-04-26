import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateSchoolDto {
  @ApiProperty({ example: 'Lycée Moderne de Cocody' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: 'LMC',
    description: 'Uppercase alphanumeric, 2–10 chars',
  })
  @IsString()
  @Matches(/^[A-Z0-9-]{2,10}$/, {
    message: 'Sigle must be 2–10 uppercase alphanumeric characters',
  })
  sigle: string;

  @ApiProperty({ example: '12 Rue des Jardins, Cocody' })
  @IsString()
  @MinLength(5)
  @MaxLength(255)
  address: string;
}
