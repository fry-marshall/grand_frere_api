import {
  Body,
  Controller,
  Get,
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
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApiSuccessResponse } from '../../common/swagger/api-responses.decorator';
import { ParentsService } from './parents.service';
import { ParentResponseDto } from './dto/parent-response.dto';
import { UpdateParentProfileDto } from './dto/update-parent-profile.dto';
import { AddBeneficiaryDto } from './dto/add-beneficiary.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Role } from '../../common/decorators/role.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ErrorResponse } from '../../common/swagger/api-responses';
import { ErrorMessages } from '../../common/swagger/error-messages';
import { UserRole } from '../users/user.types';

@ApiTags('Parents')
@ApiBearerAuth()
@Controller({ version: '1', path: 'parents' })
export class ParentsController {
  constructor(private readonly parentsService: ParentsService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Role(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'List parents' })
  @ApiSuccessResponse(ParentResponseDto)
  findAll(
    @CurrentUser() currentUser: { id: string; role: UserRole },
    @Query() query: PaginationQueryDto,
  ) {
    return this.parentsService.findAll(currentUser, query);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Role(UserRole.PARENT)
  @ApiOperation({ summary: 'Get current parent profile' })
  @ApiSuccessResponse(ParentResponseDto)
  getMe(@CurrentUser() currentUser: { id: string; role: UserRole }) {
    return this.parentsService.findMe(currentUser.id);
  }

  @Put('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Role(UserRole.PARENT)
  @ApiOperation({ summary: 'Update current parent profile' })
  @ApiSuccessResponse(ParentResponseDto)
  @ApiConflictResponse({
    description: ErrorMessages.AUTH.PHONE_ALREADY_EXISTS,
    type: ErrorResponse,
  })
  updateMe(
    @Body() dto: UpdateParentProfileDto,
    @CurrentUser() currentUser: { id: string; role: UserRole },
  ) {
    return this.parentsService.updateProfile(currentUser.id, dto);
  }

  @Post('me/students')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Role(UserRole.PARENT)
  @ApiOperation({ summary: 'Link or create a student for the current parent' })
  @ApiSuccessResponse(ParentResponseDto, 201)
  @ApiNotFoundResponse({
    description: ErrorMessages.CARDS.NOT_FOUND,
    type: ErrorResponse,
  })
  @ApiForbiddenResponse({ description: 'Access denied', type: ErrorResponse })
  @ApiConflictResponse({
    description:
      'Parent already linked to student / student already has 2 parents',
    type: ErrorResponse,
  })
  addBeneficiary(
    @Body() dto: AddBeneficiaryDto,
    @CurrentUser() currentUser: { id: string; role: UserRole },
  ) {
    return this.parentsService.addBeneficiary(currentUser.id, dto);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Role(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.PARENT)
  @ApiOperation({ summary: 'Get parent by id' })
  @ApiSuccessResponse(ParentResponseDto)
  @ApiNotFoundResponse({
    description: ErrorMessages.PARENTS.NOT_FOUND,
    type: ErrorResponse,
  })
  @ApiForbiddenResponse({ description: 'Access denied', type: ErrorResponse })
  findOne(
    @Param('id') id: string,
    @CurrentUser() currentUser: { id: string; role: UserRole },
  ) {
    return this.parentsService.findOne(id, currentUser);
  }

  @Get(':id/students')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Role(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.PARENT)
  @ApiOperation({ summary: "List parent's students" })
  @ApiSuccessResponse(ParentResponseDto)
  @ApiNotFoundResponse({
    description: ErrorMessages.PARENTS.NOT_FOUND,
    type: ErrorResponse,
  })
  @ApiForbiddenResponse({ description: 'Access denied', type: ErrorResponse })
  findStudents(
    @Param('id') id: string,
    @CurrentUser() currentUser: { id: string; role: UserRole },
  ) {
    return this.parentsService.findStudents(id, currentUser);
  }
}
