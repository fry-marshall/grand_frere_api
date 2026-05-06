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

export class SignupParentDto {
  @ApiProperty({ example: 'GF-2024-001' })
  @IsString()
  @IsNotEmpty()
  cardCode: string;

  @ApiProperty({ example: 'Aminata' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ example: 'Koné' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({ example: '+22501000000' })
  @IsString()
  @Matches(CI_PHONE_REGEX, { message: CI_PHONE_MESSAGE })
  phone: string;

  @ApiProperty({ example: 'SecurePass123' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ example: 'Kouassi', description: "Student's first name" })
  @IsString()
  @IsNotEmpty()
  studentFirstName: string;

  @ApiProperty({ example: 'Yao', description: "Student's last name" })
  @IsString()
  @IsNotEmpty()
  studentLastName: string;

  @ApiPropertyOptional({ example: '6ème A' })
  @IsOptional()
  @IsString()
  studentClass?: string;

  @ApiPropertyOptional({
    example: '1234',
    description:
      '4-digit PIN for the card. Required when the card is unassigned.',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}$/, { message: 'PIN must be exactly 4 digits' })
  pin?: string;
}
