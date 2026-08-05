import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';
import {
  CI_PHONE_REGEX,
  CI_PHONE_MESSAGE,
} from '../../../common/validation/phone.validator';

export class UpdateMeDto {
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
}
