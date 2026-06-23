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
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderResponseDto } from './dto/order-response.dto';
import { OrderDetailResponseDto } from './dto/order-detail-response.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Role } from '../../common/decorators/role.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../users/user.types';
import { ErrorResponse } from '../../common/swagger/api-responses';
import { ErrorMessages } from '../../common/swagger/error-messages';

@ApiTags('Orders')
@Controller({ version: '1', path: 'orders' })
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Role(
    UserRole.SUPER_ADMIN,
    UserRole.SCHOOL_ADMIN,
    UserRole.VENDOR,
    UserRole.PARENT,
    UserRole.STUDENT,
  )
  @ApiOperation({ summary: 'List orders (filtered by role)' })
  @ApiSuccessResponse(OrderResponseDto)
  @ApiForbiddenResponse({ description: 'Access denied', type: ErrorResponse })
  findAll(
    @CurrentUser() currentUser: { id: string; role: UserRole },
    @Query() query: PaginationQueryDto,
  ) {
    return this.ordersService.findAll(currentUser, query);
  }

  @Get('by-card')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Role(UserRole.VENDOR)
  @ApiOperation({
    summary:
      'Find the VALIDATED order for a student by card code (cashin scan)',
  })
  @ApiSuccessResponse(OrderDetailResponseDto)
  @ApiNotFoundResponse({
    description: `${ErrorMessages.CARDS.NOT_FOUND} | ${ErrorMessages.STUDENTS.NOT_FOUND} | ${ErrorMessages.ORDERS.NOT_FOUND}`,
    type: ErrorResponse,
  })
  @ApiForbiddenResponse({ description: 'Access denied', type: ErrorResponse })
  findByCard(
    @Query('cardCode') cardCode: string,
    @CurrentUser() currentUser: { id: string; role: UserRole },
  ) {
    return this.ordersService.findByCard(cardCode, currentUser);
  }

  @Get('by-code')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Role(UserRole.VENDOR)
  @ApiOperation({
    summary:
      'Find the VALIDATED order by 4-digit short code (cashin manual entry)',
  })
  @ApiSuccessResponse(OrderDetailResponseDto)
  @ApiNotFoundResponse({
    description: ErrorMessages.ORDERS.NOT_FOUND,
    type: ErrorResponse,
  })
  @ApiForbiddenResponse({ description: 'Access denied', type: ErrorResponse })
  findByCode(
    @Query('code') code: string,
    @CurrentUser() currentUser: { id: string; role: UserRole },
  ) {
    return this.ordersService.findByCode(code, currentUser);
  }

  @Get(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Role(
    UserRole.SUPER_ADMIN,
    UserRole.SCHOOL_ADMIN,
    UserRole.VENDOR,
    UserRole.PARENT,
    UserRole.STUDENT,
  )
  @ApiOperation({ summary: 'Get order details with items' })
  @ApiSuccessResponse(OrderDetailResponseDto)
  @ApiNotFoundResponse({
    description: ErrorMessages.ORDERS.NOT_FOUND,
    type: ErrorResponse,
  })
  @ApiForbiddenResponse({ description: 'Access denied', type: ErrorResponse })
  findOne(
    @Param('id') id: string,
    @CurrentUser() currentUser: { id: string; role: UserRole },
  ) {
    return this.ordersService.findOne(id, currentUser);
  }

  @Put(':id/validate')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Role(UserRole.VENDOR, UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Validate a pending order and credit vendor wallet',
  })
  @ApiSuccessResponse(OrderResponseDto)
  @ApiNotFoundResponse({
    description: ErrorMessages.ORDERS.NOT_FOUND,
    type: ErrorResponse,
  })
  @ApiBadRequestResponse({
    description: ErrorMessages.ORDERS.NOT_PENDING,
    type: ErrorResponse,
  })
  @ApiForbiddenResponse({ description: 'Access denied', type: ErrorResponse })
  validate(
    @Param('id') id: string,
    @CurrentUser() currentUser: { id: string; role: UserRole },
  ) {
    return this.ordersService.validate(id, currentUser);
  }

  @Put(':id/complete')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Role(UserRole.VENDOR, UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Complete a validated order (cashin / delivery confirmation)',
  })
  @ApiSuccessResponse(OrderResponseDto)
  @ApiNotFoundResponse({
    description: ErrorMessages.ORDERS.NOT_FOUND,
    type: ErrorResponse,
  })
  @ApiBadRequestResponse({
    description: ErrorMessages.ORDERS.NOT_VALIDATED,
    type: ErrorResponse,
  })
  @ApiForbiddenResponse({ description: 'Access denied', type: ErrorResponse })
  complete(
    @Param('id') id: string,
    @CurrentUser() currentUser: { id: string; role: UserRole },
  ) {
    return this.ordersService.complete(id, currentUser);
  }

  @Put(':id/cancel')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Role(
    UserRole.SUPER_ADMIN,
    UserRole.SCHOOL_ADMIN,
    UserRole.VENDOR,
    UserRole.PARENT,
    UserRole.STUDENT,
  )
  @ApiOperation({
    summary: 'Cancel a pending order and release wallet reservation',
  })
  @ApiSuccessResponse(OrderResponseDto)
  @ApiNotFoundResponse({
    description: ErrorMessages.ORDERS.NOT_FOUND,
    type: ErrorResponse,
  })
  @ApiBadRequestResponse({
    description: ErrorMessages.ORDERS.NOT_PENDING,
    type: ErrorResponse,
  })
  @ApiForbiddenResponse({ description: 'Access denied', type: ErrorResponse })
  cancel(
    @Param('id') id: string,
    @CurrentUser() currentUser: { id: string; role: UserRole },
  ) {
    return this.ordersService.cancel(id, currentUser);
  }

  @Post('vendor/:vendorId')
  @HttpCode(201)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Role(
    UserRole.VENDOR,
    UserRole.SUPER_ADMIN,
    UserRole.PARENT,
    UserRole.STUDENT,
  )
  @ApiOperation({ summary: 'Create an order for a student' })
  @ApiSuccessResponse(OrderResponseDto, 201)
  @ApiNotFoundResponse({
    description: `${ErrorMessages.VENDORS.NOT_FOUND} | ${ErrorMessages.STUDENTS.NOT_FOUND} | ${ErrorMessages.WALLETS.NOT_FOUND}`,
    type: ErrorResponse,
  })
  @ApiBadRequestResponse({
    description: `${ErrorMessages.ORDERS.INVALID_ITEMS} | ${ErrorMessages.ORDERS.INSUFFICIENT_BALANCE} | ${ErrorMessages.ORDERS.DAILY_LIMIT_EXCEEDED}`,
    type: ErrorResponse,
  })
  @ApiForbiddenResponse({ description: 'Access denied', type: ErrorResponse })
  create(
    @Param('vendorId') vendorId: string,
    @Body() dto: CreateOrderDto,
    @CurrentUser() currentUser: { id: string; role: UserRole },
  ) {
    return this.ordersService.create(vendorId, dto, currentUser);
  }
}
