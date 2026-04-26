import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ApiSuccessResponse } from '../../common/swagger/api-responses.decorator';
import { CardsService } from './cards.service';
import { CreateCardsBatchDto } from './dto/create-cards-batch.dto';
import { CardResponseDto } from './dto/card-response.dto';
import { UpdateDailyLimitDto } from './dto/update-daily-limit.dto';
import { VerifyPinDto } from './dto/verify-pin.dto';
import { ResetPinDto } from './dto/reset-pin.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Role } from '../../common/decorators/role.decorator';
import { ErrorResponse } from '../../common/swagger/api-responses';
import { ErrorMessages } from '../../common/swagger/error-messages';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../users/user.types';

@ApiTags('Cards')
@ApiBearerAuth()
@Controller({ version: '1', path: 'cards' })
export class CardsController {
  constructor(private readonly cardsService: CardsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Role(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Generate a batch of cards with QR codes for a school',
  })
  @ApiResponse({ status: 201, type: [CardResponseDto] })
  @ApiBadRequestResponse({
    description: 'Validation failed',
    type: ErrorResponse,
  })
  @ApiNotFoundResponse({
    description: ErrorMessages.SCHOOLS.NOT_FOUND,
    type: ErrorResponse,
  })
  createBatch(@Body() dto: CreateCardsBatchDto) {
    return this.cardsService.createBatch(dto);
  }

  @Get(':code')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Role(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Get card details by code' })
  @ApiSuccessResponse(CardResponseDto)
  @ApiNotFoundResponse({
    description: ErrorMessages.CARDS.NOT_FOUND,
    type: ErrorResponse,
  })
  findOne(
    @Param('code') code: string,
    @CurrentUser() currentUser: { id: string; role: UserRole },
  ) {
    return this.cardsService.findOne(code, currentUser);
  }

  @Put(':code/suspend')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Role(
    UserRole.SUPER_ADMIN,
    UserRole.SCHOOL_ADMIN,
    UserRole.PARENT,
    UserRole.STUDENT,
  )
  @ApiOperation({ summary: 'Suspend an active card' })
  @ApiSuccessResponse(CardResponseDto)
  @ApiNotFoundResponse({
    description: ErrorMessages.CARDS.NOT_FOUND,
    type: ErrorResponse,
  })
  @ApiConflictResponse({
    description: ErrorMessages.CARDS.NOT_SUSPENDABLE,
    type: ErrorResponse,
  })
  suspend(
    @Param('code') code: string,
    @CurrentUser() currentUser: { id: string; role: UserRole },
  ) {
    return this.cardsService.suspend(code, currentUser);
  }

  @Put(':code/activate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Role(
    UserRole.SUPER_ADMIN,
    UserRole.SCHOOL_ADMIN,
    UserRole.PARENT,
    UserRole.STUDENT,
  )
  @ApiOperation({ summary: 'Reactivate a suspended card' })
  @ApiSuccessResponse(CardResponseDto)
  @ApiNotFoundResponse({
    description: ErrorMessages.CARDS.NOT_FOUND,
    type: ErrorResponse,
  })
  @ApiConflictResponse({
    description: ErrorMessages.CARDS.NOT_ACTIVATABLE,
    type: ErrorResponse,
  })
  activate(
    @Param('code') code: string,
    @CurrentUser() currentUser: { id: string; role: UserRole },
  ) {
    return this.cardsService.activate(code, currentUser);
  }

  @Put(':code/daily-limit')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Role(UserRole.PARENT, UserRole.STUDENT)
  @HttpCode(200)
  @ApiOperation({
    summary: "Update the daily spending limit on a student's card",
  })
  @ApiSuccessResponse(CardResponseDto)
  @ApiNotFoundResponse({
    description: ErrorMessages.CARDS.NOT_FOUND,
    type: ErrorResponse,
  })
  @ApiForbiddenResponse({
    description: ErrorMessages.CARDS.DAILY_LIMIT_FORBIDDEN,
    type: ErrorResponse,
  })
  @ApiBadRequestResponse({
    description: 'Validation failed',
    type: ErrorResponse,
  })
  updateDailyLimit(
    @Param('code') code: string,
    @Body() dto: UpdateDailyLimitDto,
    @CurrentUser() currentUser: { id: string; role: UserRole },
  ) {
    return this.cardsService.updateDailyLimit(code, dto, currentUser);
  }

  @Post(':code/verify-pin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Role(UserRole.VENDOR)
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Verify student PIN — increments attempts, blocks after 3 failures',
  })
  @ApiSuccessResponse(CardResponseDto)
  @ApiNotFoundResponse({
    description: ErrorMessages.CARDS.NOT_FOUND,
    type: ErrorResponse,
  })
  @ApiUnauthorizedResponse({
    description: ErrorMessages.CARDS.PIN_INVALID,
    type: ErrorResponse,
  })
  @ApiForbiddenResponse({
    description: ErrorMessages.CARDS.CARD_BLOCKED,
    type: ErrorResponse,
  })
  @ApiConflictResponse({
    description: ErrorMessages.CARDS.NOT_ACTIVE,
    type: ErrorResponse,
  })
  @ApiBadRequestResponse({
    description: 'Validation failed',
    type: ErrorResponse,
  })
  verifyPin(@Param('code') code: string, @Body() dto: VerifyPinDto) {
    return this.cardsService.verifyPin(code, dto);
  }

  @Put(':code/reset-pin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Role(UserRole.STUDENT, UserRole.PARENT)
  @ApiOperation({
    summary: 'Reset card PIN — verifies password, unblocks card if blocked',
  })
  @ApiSuccessResponse(CardResponseDto)
  @ApiNotFoundResponse({
    description: ErrorMessages.CARDS.NOT_FOUND,
    type: ErrorResponse,
  })
  @ApiUnauthorizedResponse({
    description: ErrorMessages.CARDS.INVALID_PASSWORD,
    type: ErrorResponse,
  })
  @ApiForbiddenResponse({
    description: 'Not the card owner',
    type: ErrorResponse,
  })
  @ApiBadRequestResponse({
    description: 'Validation failed',
    type: ErrorResponse,
  })
  resetPin(
    @Param('code') code: string,
    @Body() dto: ResetPinDto,
    @CurrentUser() currentUser: { id: string; role: UserRole },
  ) {
    return this.cardsService.resetPin(code, dto, currentUser);
  }
}
