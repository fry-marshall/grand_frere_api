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
  ApiConsumes,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApiSuccessResponse } from '../../common/swagger/api-responses.decorator';
import { ItemsService } from './items.service';
import { ItemResponseDto } from './dto/item-response.dto';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
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

@ApiTags('Items')
@ApiBearerAuth()
@Controller({ version: '1', path: 'items' })
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Role(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.VENDOR)
  @ApiOperation({ summary: 'List items' })
  @ApiSuccessResponse(ItemResponseDto)
  findAll(
    @CurrentUser() currentUser: { id: string; role: UserRole },
    @Query() query: PaginationQueryDto,
  ) {
    return this.itemsService.findAll(currentUser, query);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Role(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.VENDOR)
  @ApiOperation({ summary: 'Get item by id' })
  @ApiSuccessResponse(ItemResponseDto)
  @ApiNotFoundResponse({
    description: ErrorMessages.ITEMS.NOT_FOUND,
    type: ErrorResponse,
  })
  @ApiForbiddenResponse({ description: 'Access denied', type: ErrorResponse })
  findOne(
    @Param('id') id: string,
    @CurrentUser() currentUser: { id: string; role: UserRole },
  ) {
    return this.itemsService.findOne(id, currentUser);
  }

  @Post('vendor/:vendorId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Role(UserRole.SUPER_ADMIN, UserRole.VENDOR)
  @ApiOperation({ summary: 'Create an item for a vendor' })
  @ApiSuccessResponse(ItemResponseDto)
  @ApiNotFoundResponse({
    description: ErrorMessages.VENDORS.NOT_FOUND,
    type: ErrorResponse,
  })
  @ApiForbiddenResponse({ description: 'Access denied', type: ErrorResponse })
  create(
    @Param('vendorId') vendorId: string,
    @Body() dto: CreateItemDto,
    @CurrentUser() currentUser: { id: string; role: UserRole },
  ) {
    return this.itemsService.create(vendorId, dto, currentUser);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Role(UserRole.SUPER_ADMIN, UserRole.VENDOR)
  @ApiOperation({ summary: 'Update an item' })
  @ApiSuccessResponse(ItemResponseDto)
  @ApiNotFoundResponse({
    description: ErrorMessages.ITEMS.NOT_FOUND,
    type: ErrorResponse,
  })
  @ApiForbiddenResponse({ description: 'Access denied', type: ErrorResponse })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateItemDto,
    @CurrentUser() currentUser: { id: string; role: UserRole },
  ) {
    return this.itemsService.update(id, dto, currentUser);
  }

  @Put(':id/image')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Role(UserRole.SUPER_ADMIN, UserRole.VENDOR)
  @UseInterceptors(
    FileInterceptor('file', createMulterOptions(FILE_CONFIGS.ITEM_IMAGE)),
  )
  @UseFilters(MulterExceptionFilter)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: "Upload or replace item's image" })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @ApiSuccessResponse(ItemResponseDto)
  @ApiNotFoundResponse({
    description: ErrorMessages.ITEMS.NOT_FOUND,
    type: ErrorResponse,
  })
  @ApiForbiddenResponse({ description: 'Access denied', type: ErrorResponse })
  updateImage(
    @Param('id') id: string,
    @UploadedFile(new FileValidationPipe({ required: true }))
    file: Express.Multer.File,
    @CurrentUser() currentUser: { id: string; role: UserRole },
  ) {
    return this.itemsService.updateImage(id, file, currentUser);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Role(UserRole.SUPER_ADMIN, UserRole.VENDOR)
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete an item' })
  @ApiNoContentResponse({ description: 'Item deleted' })
  @ApiNotFoundResponse({
    description: ErrorMessages.ITEMS.NOT_FOUND,
    type: ErrorResponse,
  })
  @ApiForbiddenResponse({ description: 'Access denied', type: ErrorResponse })
  remove(
    @Param('id') id: string,
    @CurrentUser() currentUser: { id: string; role: UserRole },
  ) {
    return this.itemsService.remove(id, currentUser);
  }
}
