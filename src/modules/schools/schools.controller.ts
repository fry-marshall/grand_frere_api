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
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApiSuccessResponse } from '../../common/swagger/api-responses.decorator';
import { SchoolsService } from './schools.service';
import { CreateSchoolDto } from './dto/create-school.dto';
import { CreateSchoolAdminDto } from './dto/create-school-admin.dto';
import { UpdateSchoolDto } from './dto/update-school.dto';
import { SchoolResponseDto } from './dto/school-response.dto';
import { SchoolAdminResponseDto } from './dto/school-admin-response.dto';
import { SchoolVendorResponseDto } from './dto/school-vendor-response.dto';
import { SchoolStudentResponseDto } from './dto/school-student-response.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Role } from '../../common/decorators/role.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ErrorResponse } from '../../common/swagger/api-responses';
import { ErrorMessages } from '../../common/swagger/error-messages';
import { UserRole } from '../users/user.types';

@ApiTags('Schools')
@ApiBearerAuth()
@Controller({ version: '1', path: 'schools' })
export class SchoolsController {
  constructor(private readonly schoolsService: SchoolsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Role(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a new school' })
  @ApiSuccessResponse(SchoolResponseDto, 201)
  @ApiBadRequestResponse({
    description: 'Validation failed',
    type: ErrorResponse,
  })
  @ApiConflictResponse({
    description: ErrorMessages.SCHOOLS.SIGLE_ALREADY_EXISTS,
    type: ErrorResponse,
  })
  create(@Body() dto: CreateSchoolDto) {
    return this.schoolsService.create(dto);
  }

  @Post(':id/admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Role(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a school admin for a given school' })
  @ApiSuccessResponse(SchoolAdminResponseDto, 201)
  @ApiBadRequestResponse({
    description: 'Validation failed',
    type: ErrorResponse,
  })
  @ApiNotFoundResponse({
    description: ErrorMessages.SCHOOLS.NOT_FOUND,
    type: ErrorResponse,
  })
  @ApiConflictResponse({
    description: ErrorMessages.AUTH.PHONE_ALREADY_EXISTS,
    type: ErrorResponse,
  })
  createAdmin(@Param('id') id: string, @Body() dto: CreateSchoolAdminDto) {
    return this.schoolsService.createAdmin(id, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Role(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'List all schools' })
  @ApiSuccessResponse(SchoolResponseDto)
  findAll() {
    return this.schoolsService.findAll();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Role(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Get school details' })
  @ApiSuccessResponse(SchoolResponseDto)
  @ApiNotFoundResponse({
    description: ErrorMessages.SCHOOLS.NOT_FOUND,
    type: ErrorResponse,
  })
  @ApiForbiddenResponse({ description: 'Not your school', type: ErrorResponse })
  findOne(
    @Param('id') id: string,
    @CurrentUser() currentUser: { id: string; role: UserRole },
  ) {
    return this.schoolsService.findOne(id, currentUser);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Role(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update school name or address' })
  @ApiSuccessResponse(SchoolResponseDto)
  @ApiBadRequestResponse({
    description: 'Validation failed',
    type: ErrorResponse,
  })
  @ApiNotFoundResponse({
    description: ErrorMessages.SCHOOLS.NOT_FOUND,
    type: ErrorResponse,
  })
  update(@Param('id') id: string, @Body() dto: UpdateSchoolDto) {
    return this.schoolsService.update(id, dto);
  }

  @Put(':id/suspend')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Role(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Suspend an active school' })
  @ApiSuccessResponse(SchoolResponseDto)
  @ApiNotFoundResponse({
    description: ErrorMessages.SCHOOLS.NOT_FOUND,
    type: ErrorResponse,
  })
  @ApiConflictResponse({
    description: ErrorMessages.SCHOOLS.NOT_SUSPENDABLE,
    type: ErrorResponse,
  })
  suspend(@Param('id') id: string) {
    return this.schoolsService.suspend(id);
  }

  @Put(':id/activate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Role(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Reactivate a suspended school' })
  @ApiSuccessResponse(SchoolResponseDto)
  @ApiNotFoundResponse({
    description: ErrorMessages.SCHOOLS.NOT_FOUND,
    type: ErrorResponse,
  })
  @ApiConflictResponse({
    description: ErrorMessages.SCHOOLS.NOT_ACTIVATABLE,
    type: ErrorResponse,
  })
  activate(@Param('id') id: string) {
    return this.schoolsService.activate(id);
  }

  @Get(':id/vendors')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Role(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'List vendors of a school' })
  @ApiSuccessResponse(SchoolVendorResponseDto)
  @ApiNotFoundResponse({
    description: ErrorMessages.SCHOOLS.NOT_FOUND,
    type: ErrorResponse,
  })
  @ApiForbiddenResponse({ description: 'Not your school', type: ErrorResponse })
  findVendors(
    @Param('id') id: string,
    @CurrentUser() currentUser: { id: string; role: UserRole },
    @Query() query: PaginationQueryDto,
  ) {
    return this.schoolsService.findVendors(id, currentUser, query);
  }

  @Get(':id/students')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Role(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'List students of a school' })
  @ApiSuccessResponse(SchoolStudentResponseDto)
  @ApiNotFoundResponse({
    description: ErrorMessages.SCHOOLS.NOT_FOUND,
    type: ErrorResponse,
  })
  @ApiForbiddenResponse({ description: 'Not your school', type: ErrorResponse })
  findStudents(
    @Param('id') id: string,
    @CurrentUser() currentUser: { id: string; role: UserRole },
    @Query() query: PaginationQueryDto,
  ) {
    return this.schoolsService.findStudents(id, currentUser, query);
  }
}
