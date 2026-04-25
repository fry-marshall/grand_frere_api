import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MinLength,
} from 'class-validator';
import {
  CI_PHONE_REGEX,
  CI_PHONE_MESSAGE,
} from '../../../common/validation/phone.validator';

export class SignupVendorDto {
  @ApiProperty({ example: 'Konan' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ example: 'Brou' })
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

  @ApiProperty({ example: 'Maquis Chez Konan' })
  @IsString()
  @IsNotEmpty()
  shopName: string;

  @ApiProperty({ example: 'uuid-of-school' })
  @IsUUID()
  schoolId: string;

  @ApiPropertyOptional({ example: '+2250700000000' })
  @IsOptional()
  @IsString()
  waveNumber?: string;
}
