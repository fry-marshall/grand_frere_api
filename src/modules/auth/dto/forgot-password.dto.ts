import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';
import {
  CI_PHONE_REGEX,
  CI_PHONE_MESSAGE,
} from '../../../common/validation/phone.validator';

export class ForgotPasswordDto {
  @ApiProperty({ example: '+22501000000' })
  @IsString()
  @Matches(CI_PHONE_REGEX, { message: CI_PHONE_MESSAGE })
  phone: string;
}
