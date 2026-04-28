import {
  Body,
  Controller,
  HttpCode,
  Param,
  Post,
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

  @Post('vendor/:vendorId')
  @HttpCode(201)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Role(UserRole.VENDOR, UserRole.SUPER_ADMIN)
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
