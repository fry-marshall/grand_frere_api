import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
  HttpCode,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiConsumes,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ApiSuccessResponse } from '../../common/swagger/api-responses.decorator';
import { CardsService } from './cards.service';
import { CreateCardsBatchDto } from './dto/create-cards-batch.dto';
import { CreateCardsBatchResponseDto } from './dto/create-cards-batch-response.dto';
import { UploadBatchPdfResponseDto } from './dto/upload-batch-pdf-response.dto';
import { CardsSearchQueryDto } from './dto/cards-search-query.dto';
import { CardResponseDto } from './dto/card-response.dto';
import { CardListItemResponseDto } from './dto/card-list-item-response.dto';
import {
  FILE_CONFIGS,
  createMulterOptions,
} from '../../common/multer/multer.config';
import { MulterExceptionFilter } from '../../common/multer/multer-exception.filter';
import { FileValidationPipe } from '../../common/multer/file-validation.pipe';
import { UpdateDailyLimitDto } from './dto/update-daily-limit.dto';
import { UpdateDailyLimitPermissionDto } from './dto/update-daily-limit-permission.dto';
import { VerifyPinDto } from './dto/verify-pin.dto';
import { ResetPinDto } from './dto/reset-pin.dto';
import { ReplaceCardDto } from './dto/replace-card.dto';
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

  @Post('batches')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Role(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Generate a batch of cards with QR codes for a school',
  })
  @ApiSuccessResponse(CreateCardsBatchResponseDto, 201)
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

  @Post('batches/:batchId/pdf')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Role(UserRole.SUPER_ADMIN)
  @UseInterceptors(
    FileInterceptor('file', createMulterOptions(FILE_CONFIGS.CARD_BATCH_PDF)),
  )
  @UseFilters(MulterExceptionFilter)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({
    summary:
      'Store the front-end-assembled PDF for a card batch (recto/verso composited with QR codes)',
  })
  @ApiSuccessResponse(UploadBatchPdfResponseDto, 201)
  @ApiNotFoundResponse({
    description: ErrorMessages.CARDS.BATCH_NOT_FOUND,
    type: ErrorResponse,
  })
  @ApiBadRequestResponse({
    description: 'Validation failed',
    type: ErrorResponse,
  })
  uploadBatchPdf(
    @Param('batchId') batchId: string,
    @UploadedFile(new FileValidationPipe({ required: true }))
    file: Express.Multer.File,
  ) {
    return this.cardsService.uploadBatchPdf(batchId, file);
  }

  @Get('search')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Role(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary:
      'Search/filter/paginate cards for the back-office (school, status, code search)',
  })
  @ApiSuccessResponse(CardListItemResponseDto)
  @ApiForbiddenResponse({
    description: 'Insufficient role',
    type: ErrorResponse,
  })
  search(@Query() query: CardsSearchQueryDto) {
    return this.cardsService.search(query);
  }

  @Get(':code')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Role(UserRole.SUPER_ADMIN, UserRole.PARENT, UserRole.STUDENT)
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
  @Role(UserRole.SUPER_ADMIN, UserRole.PARENT, UserRole.STUDENT)
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
  @Role(UserRole.SUPER_ADMIN, UserRole.PARENT, UserRole.STUDENT)
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
  @Role(UserRole.SUPER_ADMIN, UserRole.PARENT, UserRole.STUDENT)
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

  @Put(':code/daily-limit-permission')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Role(UserRole.PARENT)
  @HttpCode(200)
  @ApiOperation({
    summary:
      "Allow or forbid the student from editing their own card's daily spending limit",
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
  updateDailyLimitPermission(
    @Param('code') code: string,
    @Body() dto: UpdateDailyLimitPermissionDto,
    @CurrentUser() currentUser: { id: string; role: UserRole },
  ) {
    return this.cardsService.updateDailyLimitPermission(code, dto, currentUser);
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

  @Put(':code/replace')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Role(UserRole.SUPER_ADMIN, UserRole.PARENT, UserRole.STUDENT)
  @ApiOperation({
    summary:
      'Replace a lost card with a blank one, carrying over the PIN, daily limit and student link',
  })
  @ApiSuccessResponse(CardResponseDto)
  @ApiNotFoundResponse({
    description: ErrorMessages.CARDS.NOT_FOUND,
    type: ErrorResponse,
  })
  @ApiConflictResponse({
    description: `${ErrorMessages.CARDS.NOT_REPLACEABLE} | ${ErrorMessages.CARDS.SAME_CARD} | ${ErrorMessages.CARDS.NEW_CARD_NOT_BLANK} | ${ErrorMessages.CARDS.SCHOOL_MISMATCH}`,
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
  replaceCard(
    @Param('code') code: string,
    @Body() dto: ReplaceCardDto,
    @CurrentUser() currentUser: { id: string; role: UserRole },
  ) {
    return this.cardsService.replaceCard(code, dto, currentUser);
  }
}
