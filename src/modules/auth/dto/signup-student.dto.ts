import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import {
  CI_PHONE_REGEX,
  CI_PHONE_MESSAGE,
} from '../../../common/validation/phone.validator';

export class SignupStudentDto {
  @ApiProperty({ example: 'GF-2024-001' })
  @IsString()
  @IsNotEmpty()
  cardCode: string;

  @ApiPropertyOptional({
    example: 'Kouassi',
    description:
      'Required only when the card is unassigned. If a parent already ' +
      'registered this student, their name is kept and this field is ignored.',
  })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({
    example: 'Yao',
    description:
      'Required only when the card is unassigned. If a parent already ' +
      'registered this student, their name is kept and this field is ignored.',
  })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiProperty({ example: '+22501000000' })
  @IsString()
  @Matches(CI_PHONE_REGEX, { message: CI_PHONE_MESSAGE })
  phone: string;

  @ApiProperty({ example: 'SecurePass123' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({ example: '6ème A' })
  @IsOptional()
  @IsString()
  class?: string;

  @ApiPropertyOptional({
    example: '1234',
    description: '4-digit PIN to set on the card at activation.',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}$/, { message: 'PIN must be exactly 4 digits' })
  pin?: string;
}
