import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import {
  CI_PHONE_REGEX,
  CI_PHONE_MESSAGE,
} from '../../../common/validation/phone.validator';
import { Gender } from '../../users/user.types';

export class SubmitSchoolJoinRequestDto {
  @ApiProperty({ example: 'Lycée Moderne de Cocody' })
  @IsString()
  @IsNotEmpty()
  schoolName: string;

  @ApiProperty({ example: 'Abidjan' })
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiProperty({ example: 450 })
  @IsInt()
  @Min(1)
  studentCount: number;

  @ApiProperty({ enum: Gender, example: Gender.MALE })
  @IsEnum(Gender)
  gender: Gender;

  @ApiProperty({ example: 'Kouamé' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ example: 'Assi' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({ example: '+22507000000001' })
  @IsString()
  @Matches(CI_PHONE_REGEX, { message: CI_PHONE_MESSAGE })
  phone: string;

  @ApiProperty({ example: 'contact@lmc.ci' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Directeur' })
  @IsString()
  @IsNotEmpty()
  position: string;

  @ApiPropertyOptional({ example: 'We would like to join the network.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string;
}
