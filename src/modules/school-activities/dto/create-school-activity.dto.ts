import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateSchoolActivityDto {
  @ApiProperty({ example: 'Journée sportive' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @ApiProperty({
    example: 'Les élèves ont participé à des activités sportives.',
  })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiPropertyOptional({
    description:
      'Required when the caller is a SUPER_ADMIN. Ignored for SCHOOL_ADMIN — derived from their own school.',
  })
  @IsOptional()
  @IsUUID()
  schoolId?: string;
}
