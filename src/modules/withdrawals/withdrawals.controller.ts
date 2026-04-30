import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApiSuccessResponse } from '../../common/swagger/api-responses.decorator';
import { WithdrawalsService } from './withdrawals.service';
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto';
import { WithdrawalResponseDto } from './dto/withdrawal-response.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Role } from '../../common/decorators/role.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../users/user.types';
import { ErrorResponse } from '../../common/swagger/api-responses';
import { ErrorMessages } from '../../common/swagger/error-messages';

@ApiTags('Withdrawals')
@Controller({ version: '1', path: 'withdrawals' })
export class WithdrawalsController {
  constructor(private readonly withdrawalsService: WithdrawalsService) {}

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Role(UserRole.VENDOR, UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'List withdrawals (VENDOR sees own, SUPER_ADMIN sees all)',
  })
  @ApiSuccessResponse(WithdrawalResponseDto)
  @ApiForbiddenResponse({ description: 'Access denied', type: ErrorResponse })
  findAll(
    @CurrentUser() currentUser: { id: string; role: UserRole },
    @Query() query: PaginationQueryDto,
  ) {
    return this.withdrawalsService.findAll(currentUser, query);
  }

  @Put(':id/process')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Role(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Mark a withdrawal as IN_PROGRESS (SUPER_ADMIN only)',
  })
  @ApiSuccessResponse(WithdrawalResponseDto)
  @ApiNotFoundResponse({
    description: ErrorMessages.WITHDRAWALS.NOT_FOUND,
    type: ErrorResponse,
  })
  @ApiBadRequestResponse({
    description: ErrorMessages.WITHDRAWALS.NOT_PENDING,
    type: ErrorResponse,
  })
  @ApiForbiddenResponse({ description: 'Access denied', type: ErrorResponse })
  process(@Param('id') id: string, @Query('paystackRef') paystackRef?: string) {
    return this.withdrawalsService.process(id, paystackRef);
  }

  @Put(':id/complete')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Role(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Mark a withdrawal as SUCCESS (SUPER_ADMIN only)' })
  @ApiSuccessResponse(WithdrawalResponseDto)
  @ApiNotFoundResponse({
    description: ErrorMessages.WITHDRAWALS.NOT_FOUND,
    type: ErrorResponse,
  })
  @ApiBadRequestResponse({
    description: ErrorMessages.WITHDRAWALS.NOT_IN_PROGRESS,
    type: ErrorResponse,
  })
  @ApiForbiddenResponse({ description: 'Access denied', type: ErrorResponse })
  complete(@Param('id') id: string) {
    return this.withdrawalsService.complete(id);
  }

  @Put(':id/fail')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Role(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary:
      'Mark a withdrawal as FAILED and refund vendor wallet (SUPER_ADMIN only)',
  })
  @ApiSuccessResponse(WithdrawalResponseDto)
  @ApiNotFoundResponse({
    description: ErrorMessages.WITHDRAWALS.NOT_FOUND,
    type: ErrorResponse,
  })
  @ApiBadRequestResponse({
    description: ErrorMessages.WITHDRAWALS.NOT_PENDING,
    type: ErrorResponse,
  })
  @ApiForbiddenResponse({ description: 'Access denied', type: ErrorResponse })
  fail(@Param('id') id: string) {
    return this.withdrawalsService.fail(id);
  }

  @Post('vendor/:vendorId')
  @HttpCode(201)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Role(UserRole.VENDOR, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Request a withdrawal from vendor wallet' })
  @ApiSuccessResponse(WithdrawalResponseDto, 201)
  @ApiNotFoundResponse({
    description: `${ErrorMessages.VENDORS.NOT_FOUND} | ${ErrorMessages.VENDORS.WALLET_NOT_FOUND}`,
    type: ErrorResponse,
  })
  @ApiBadRequestResponse({
    description: ErrorMessages.WITHDRAWALS.INSUFFICIENT_BALANCE,
    type: ErrorResponse,
  })
  @ApiForbiddenResponse({ description: 'Access denied', type: ErrorResponse })
  create(
    @Param('vendorId') vendorId: string,
    @Body() dto: CreateWithdrawalDto,
    @CurrentUser() currentUser: { id: string; role: UserRole },
  ) {
    return this.withdrawalsService.create(vendorId, dto, currentUser);
  }
}
