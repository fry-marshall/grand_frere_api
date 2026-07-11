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
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiConsumes,
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
import { VendorStatsResponseDto } from './dto/vendor-stats-response.dto';
import { ItemResponseDto } from '../items/dto/item-response.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import {
  FILE_CONFIGS,
  createMulterOptions,
} from '../../common/multer/multer.config';
import { FileValidationPipe } from '../../common/multer/file-validation.pipe';
import { MulterExceptionFilter } from '../../common/multer/multer-exception.filter';
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

  @Get('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Role(UserRole.VENDOR)
  @ApiOperation({ summary: 'Get current vendor profile' })
  @ApiSuccessResponse(VendorResponseDto)
  @ApiNotFoundResponse({
    description: ErrorMessages.VENDORS.NOT_FOUND,
    type: ErrorResponse,
  })
  getMe(@CurrentUser() currentUser: { id: string; role: UserRole }) {
    return this.vendorsService.findMe(currentUser.id);
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

  @Put(':id/photo')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Role(UserRole.SUPER_ADMIN, UserRole.VENDOR)
  @UseInterceptors(
    FileInterceptor('file', createMulterOptions(FILE_CONFIGS.VENDOR_PHOTO)),
  )
  @UseFilters(MulterExceptionFilter)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: "Upload or replace vendor's profile photo" })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @ApiSuccessResponse(VendorResponseDto)
  @ApiNotFoundResponse({
    description: ErrorMessages.VENDORS.NOT_FOUND,
    type: ErrorResponse,
  })
  @ApiForbiddenResponse({ description: 'Access denied', type: ErrorResponse })
  updatePhoto(
    @Param('id') id: string,
    @UploadedFile(new FileValidationPipe({ required: true }))
    file: Express.Multer.File,
    @CurrentUser() currentUser: { id: string; role: UserRole },
  ) {
    return this.vendorsService.updatePhoto(id, file, currentUser);
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

  @Get(':id/items')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Role(
    UserRole.SUPER_ADMIN,
    UserRole.SCHOOL_ADMIN,
    UserRole.VENDOR,
    UserRole.STUDENT,
    UserRole.PARENT,
  )
  @ApiOperation({ summary: 'List active items of a vendor' })
  @ApiSuccessResponse(ItemResponseDto)
  @ApiNotFoundResponse({
    description: ErrorMessages.VENDORS.NOT_FOUND,
    type: ErrorResponse,
  })
  @ApiForbiddenResponse({ description: 'Access denied', type: ErrorResponse })
  findItems(
    @Param('id') id: string,
    @CurrentUser() currentUser: { id: string; role: UserRole },
  ) {
    return this.vendorsService.findItems(id, currentUser);
  }

  @Get(':id/stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Role(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.VENDOR)
  @ApiOperation({
    summary: 'Get vendor daily stats (order count, revenue, cash to collect)',
  })
  @ApiSuccessResponse(VendorStatsResponseDto)
  @ApiNotFoundResponse({
    description: ErrorMessages.VENDORS.NOT_FOUND,
    type: ErrorResponse,
  })
  @ApiForbiddenResponse({ description: 'Access denied', type: ErrorResponse })
  findStats(
    @Param('id') id: string,
    @CurrentUser() currentUser: { id: string; role: UserRole },
  ) {
    return this.vendorsService.findStats(id, currentUser);
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
