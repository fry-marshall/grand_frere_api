import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MinLength } from 'class-validator';
import {
  CI_PHONE_REGEX,
  CI_PHONE_MESSAGE,
} from '../../../common/validation/phone.validator';

export class ResetPasswordDto {
  @ApiProperty({ example: '+22501000000' })
  @IsString()
  @Matches(CI_PHONE_REGEX, { message: CI_PHONE_MESSAGE })
  phone: string;

  @ApiProperty({ example: '482910' })
  @IsString()
  @Matches(/^\d{6}$/, { message: 'OTP must be exactly 6 digits' })
  code: string;

  @ApiProperty({ example: 'NewSecurePass123' })
  @IsString()
  @MinLength(8)
  newPassword: string;
}
