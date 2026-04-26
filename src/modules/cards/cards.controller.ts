import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ApiSuccessResponse } from '../../common/swagger/api-responses.decorator';
import { CardsService } from './cards.service';
import { CreateCardsBatchDto } from './dto/create-cards-batch.dto';
import { CardResponseDto } from './dto/card-response.dto';
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
}
