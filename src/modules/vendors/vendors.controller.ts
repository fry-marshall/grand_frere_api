import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApiSuccessResponse } from '../../common/swagger/api-responses.decorator';
import { VendorsService } from './vendors.service';
import { VendorResponseDto } from './dto/vendor-response.dto';
import { VendorOrderResponseDto } from './dto/vendor-order-response.dto';
import { VendorWithdrawalResponseDto } from './dto/vendor-withdrawal-response.dto';
import { VendorBalanceResponseDto } from './dto/vendor-balance-response.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Role } from '../../common/decorators/role.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ErrorResponse } from '../../common/swagger/api-responses';
import { ErrorMessages } from '../../common/swagger/error-messages';
import { UserRole } from '../users/user.types';

@ApiTags('Vendors')
@ApiBearerAuth()
@Controller({ version: '1', path: 'vendors' })
export class VendorsController {
  constructor(private readonly vendorsService: VendorsService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Role(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'List vendors' })
  @ApiSuccessResponse(VendorResponseDto)
  findAll(
    @CurrentUser() currentUser: { id: string; role: UserRole },
    @Query() query: PaginationQueryDto,
  ) {
    return this.vendorsService.findAll(currentUser, query);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Role(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.VENDOR)
  @ApiOperation({ summary: 'Get vendor by id' })
  @ApiSuccessResponse(VendorResponseDto)
  @ApiNotFoundResponse({
    description: ErrorMessages.VENDORS.NOT_FOUND,
    type: ErrorResponse,
  })
  @ApiForbiddenResponse({ description: 'Access denied', type: ErrorResponse })
  findOne(
    @Param('id') id: string,
    @CurrentUser() currentUser: { id: string; role: UserRole },
  ) {
    return this.vendorsService.findOne(id, currentUser);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Role(UserRole.SUPER_ADMIN, UserRole.VENDOR)
  @ApiOperation({ summary: 'Update vendor shop name or wave number' })
  @ApiSuccessResponse(VendorResponseDto)
  @ApiNotFoundResponse({
    description: ErrorMessages.VENDORS.NOT_FOUND,
    type: ErrorResponse,
  })
  @ApiForbiddenResponse({ description: 'Access denied', type: ErrorResponse })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateVendorDto,
    @CurrentUser() currentUser: { id: string; role: UserRole },
  ) {
    return this.vendorsService.update(id, dto, currentUser);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Role(UserRole.SUPER_ADMIN)
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a vendor' })
  @ApiNoContentResponse({ description: 'Vendor deleted' })
  @ApiNotFoundResponse({
    description: ErrorMessages.VENDORS.NOT_FOUND,
    type: ErrorResponse,
  })
  remove(@Param('id') id: string) {
    return this.vendorsService.remove(id);
  }

  @Get(':id/orders')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Role(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.VENDOR)
  @ApiOperation({ summary: "List vendor's orders" })
  @ApiSuccessResponse(VendorOrderResponseDto)
  @ApiNotFoundResponse({
    description: ErrorMessages.VENDORS.NOT_FOUND,
    type: ErrorResponse,
  })
  @ApiForbiddenResponse({ description: 'Access denied', type: ErrorResponse })
  findOrders(
    @Param('id') id: string,
    @CurrentUser() currentUser: { id: string; role: UserRole },
    @Query() query: PaginationQueryDto,
  ) {
    return this.vendorsService.findOrders(id, currentUser, query);
  }

  @Get(':id/withdrawals')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Role(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.VENDOR)
  @ApiOperation({ summary: "List vendor's withdrawals" })
  @ApiSuccessResponse(VendorWithdrawalResponseDto)
  @ApiNotFoundResponse({
    description: ErrorMessages.VENDORS.NOT_FOUND,
    type: ErrorResponse,
  })
  @ApiForbiddenResponse({ description: 'Access denied', type: ErrorResponse })
  findWithdrawals(
    @Param('id') id: string,
    @CurrentUser() currentUser: { id: string; role: UserRole },
    @Query() query: PaginationQueryDto,
  ) {
    return this.vendorsService.findWithdrawals(id, currentUser, query);
  }

  @Get(':id/balance')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Role(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.VENDOR)
  @ApiOperation({ summary: "Get vendor's wallet balance" })
  @ApiSuccessResponse(VendorBalanceResponseDto)
  @ApiNotFoundResponse({
    description: ErrorMessages.VENDORS.NOT_FOUND,
    type: ErrorResponse,
  })
  @ApiForbiddenResponse({ description: 'Access denied', type: ErrorResponse })
  findBalance(
    @Param('id') id: string,
    @CurrentUser() currentUser: { id: string; role: UserRole },
  ) {
    return this.vendorsService.findBalance(id, currentUser);
  }

  @Post(':id/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Role(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Approve a pending vendor' })
  @ApiSuccessResponse(VendorResponseDto)
  @ApiNotFoundResponse({
    description: ErrorMessages.VENDORS.NOT_FOUND,
    type: ErrorResponse,
  })
  @ApiConflictResponse({
    description: ErrorMessages.VENDORS.NOT_APPROVABLE,
    type: ErrorResponse,
  })
  approve(@Param('id') id: string) {
    return this.vendorsService.approve(id);
  }

  @Post(':id/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Role(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Reject a pending vendor' })
  @ApiSuccessResponse(VendorResponseDto)
  @ApiNotFoundResponse({
    description: ErrorMessages.VENDORS.NOT_FOUND,
    type: ErrorResponse,
  })
  @ApiConflictResponse({
    description: ErrorMessages.VENDORS.NOT_REJECTABLE,
    type: ErrorResponse,
  })
  reject(@Param('id') id: string) {
    return this.vendorsService.reject(id);
  }
}
