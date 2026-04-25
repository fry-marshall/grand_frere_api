import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { ScanCardDto } from './dto/scan-card.dto';
import { ScanCardResponseDto } from './dto/scan-card-response.dto';
import { ApiSuccessResponse } from '../../common/swagger/api-responses.decorator';
import { ErrorResponse } from '../../common/swagger/api-responses';
import { ErrorMessages } from '../../common/swagger/error-messages';

@ApiTags('Auth')
@Controller({ version: '1', path: 'auth' })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('scan-card')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Scan a card to check its status and linked profiles',
  })
  @ApiSuccessResponse(ScanCardResponseDto)
  @ApiBadRequestResponse({
    description: 'Validation failed',
    type: ErrorResponse,
  })
  @ApiNotFoundResponse({
    description: ErrorMessages.CARDS.NOT_FOUND,
    type: ErrorResponse,
  })
  scanCard(@Body() dto: ScanCardDto) {
    return this.authService.scanCard(dto);
  }
}
