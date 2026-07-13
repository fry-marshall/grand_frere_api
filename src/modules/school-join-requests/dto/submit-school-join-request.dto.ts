import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  CI_PHONE_REGEX,
  CI_PHONE_MESSAGE,
} from '../../../common/validation/phone.validator';

export class SubmitSchoolJoinRequestDto {
  @ApiProperty({ example: 'Lycée Moderne de Cocody' })
  @IsString()
  @IsNotEmpty()
  schoolName: string;

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

  @ApiProperty({ example: 'Kouamé' })
  @IsString()
  @IsNotEmpty()
  contactFirstName: string;

  @ApiProperty({ example: 'Assi' })
  @IsString()
  @IsNotEmpty()
  contactLastName: string;

  @ApiProperty({ example: '+22507000000001' })
  @IsString()
  @Matches(CI_PHONE_REGEX, { message: CI_PHONE_MESSAGE })
  contactPhone: string;

  @ApiPropertyOptional({ example: 'We would like to join the network.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string;
}
