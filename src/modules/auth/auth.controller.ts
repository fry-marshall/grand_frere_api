import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { ScanCardDto } from './dto/scan-card.dto';
import { ScanCardResponseDto } from './dto/scan-card-response.dto';
import { SignupParentDto } from './dto/signup-parent.dto';
import { SignupStudentDto } from './dto/signup-student.dto';
import { SignupVendorDto } from './dto/signup-vendor.dto';
import { SigninDto } from './dto/signin.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { AuthTokensResponseDto } from './dto/auth-tokens-response.dto';
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

  @Post('signup/parent')
  @ApiOperation({
    summary: 'Register a new parent account and link to a student via card',
  })
  @ApiSuccessResponse(AuthTokensResponseDto, 201)
  @ApiBadRequestResponse({
    description: 'Validation failed',
    type: ErrorResponse,
  })
  @ApiNotFoundResponse({
    description: ErrorMessages.CARDS.NOT_FOUND,
    type: ErrorResponse,
  })
  @ApiConflictResponse({
    description:
      'Card not active / phone already exists / student already has 2 parents',
    type: ErrorResponse,
  })
  signupParent(@Body() dto: SignupParentDto) {
    return this.authService.signupParent(dto);
  }

  @Post('signup/student')
  @ApiOperation({
    summary: 'Register a new student account via an unassigned card',
  })
  @ApiSuccessResponse(AuthTokensResponseDto, 201)
  @ApiBadRequestResponse({
    description: 'Validation failed',
    type: ErrorResponse,
  })
  @ApiNotFoundResponse({
    description: ErrorMessages.CARDS.NOT_FOUND,
    type: ErrorResponse,
  })
  @ApiConflictResponse({
    description: 'Card not available / phone already exists',
    type: ErrorResponse,
  })
  signupStudent(@Body() dto: SignupStudentDto) {
    return this.authService.signupStudent(dto);
  }

  @Post('signup/vendor')
  @ApiOperation({ summary: 'Register a new vendor account for a school' })
  @ApiSuccessResponse(AuthTokensResponseDto, 201)
  @ApiBadRequestResponse({
    description: 'Validation failed',
    type: ErrorResponse,
  })
  @ApiNotFoundResponse({
    description: ErrorMessages.SCHOOLS.NOT_FOUND,
    type: ErrorResponse,
  })
  @ApiConflictResponse({
    description: 'Phone already exists',
    type: ErrorResponse,
  })
  signupVendor(@Body() dto: SignupVendorDto) {
    return this.authService.signupVendor(dto);
  }

  @Post('signin')
  @HttpCode(200)
  @ApiOperation({ summary: 'Sign in with phone and password' })
  @ApiSuccessResponse(AuthTokensResponseDto)
  @ApiBadRequestResponse({
    description: 'Validation failed',
    type: ErrorResponse,
  })
  @ApiUnauthorizedResponse({
    description: ErrorMessages.AUTH.INVALID_CREDENTIALS,
    type: ErrorResponse,
  })
  signin(@Body() dto: SigninDto) {
    return this.authService.signin(dto);
  }

  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Rotate refresh token and get a new token pair' })
  @ApiSuccessResponse(AuthTokensResponseDto)
  @ApiBadRequestResponse({
    description: 'Validation failed',
    type: ErrorResponse,
  })
  @ApiUnauthorizedResponse({
    description: ErrorMessages.AUTH.INVALID_REFRESH_TOKEN,
    type: ErrorResponse,
  })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto);
  }

  @Post('signout')
  @HttpCode(200)
  @ApiOperation({ summary: 'Sign out and revoke the current refresh token' })
  @ApiOkResponse({ description: 'Signed out successfully' })
  @ApiBadRequestResponse({
    description: 'Validation failed',
    type: ErrorResponse,
  })
  signout(@Body() dto: RefreshTokenDto) {
    return this.authService.signout(dto);
  }
}
