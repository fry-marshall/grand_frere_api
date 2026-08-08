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
import { SchoolParentResponseDto } from './dto/school-parent-response.dto';
import { SchoolTransactionResponseDto } from './dto/school-transaction-response.dto';
import { SchoolTransactionsQueryDto } from './dto/school-transactions-query.dto';
import { StatsQueryDto } from './dto/stats-query.dto';
import { SchoolsSearchQueryDto } from './dto/schools-search-query.dto';
import { NetworkStatsResponseDto } from './dto/network-stats-response.dto';
import { SchoolStatsResponseDto } from './dto/school-stats-response.dto';
import { StatsTimeseriesQueryDto } from './dto/stats-timeseries-query.dto';
import { StatsTimeseriesResponseDto } from './dto/stats-timeseries-response.dto';
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
  @ApiOperation({ summary: 'List all schools (public)' })
  @ApiSuccessResponse(SchoolResponseDto)
  findAll() {
    return this.schoolsService.findAll();
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Role(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary:
      'Get network-wide stats: revenue, order volume, active students, per-school breakdown',
  })
  @ApiSuccessResponse(NetworkStatsResponseDto)
  @ApiForbiddenResponse({
    description: 'Insufficient role',
    type: ErrorResponse,
  })
  getNetworkStats(@Query() query: StatsQueryDto) {
    return this.schoolsService.getNetworkStats(query);
  }

  @Get('stats/timeseries')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Role(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary:
      'Completed order revenue/volume bucketed by day, week or month, for the network dashboard chart. Optionally scoped to a single school.',
  })
  @ApiSuccessResponse(StatsTimeseriesResponseDto)
  @ApiForbiddenResponse({
    description: 'Insufficient role',
    type: ErrorResponse,
  })
  getStatsTimeseries(@Query() query: StatsTimeseriesQueryDto) {
    return this.schoolsService.getStatsTimeseries(query);
  }

  @Get('search')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Role(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary:
      'Search/filter/paginate schools for the back-office (name/sigle search, status filter)',
  })
  @ApiSuccessResponse(SchoolResponseDto)
  @ApiForbiddenResponse({
    description: 'Insufficient role',
    type: ErrorResponse,
  })
  search(@Query() query: SchoolsSearchQueryDto) {
    return this.schoolsService.search(query);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Role(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get school details' })
  @ApiSuccessResponse(SchoolResponseDto)
  @ApiNotFoundResponse({
    description: ErrorMessages.SCHOOLS.NOT_FOUND,
    type: ErrorResponse,
  })
  @ApiForbiddenResponse({ description: 'Not your school', type: ErrorResponse })
  findOne(@Param('id') id: string) {
    return this.schoolsService.findOne(id);
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

  @Get(':id/admins')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Role(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'List school admins of a school' })
  @ApiSuccessResponse(SchoolAdminResponseDto)
  @ApiNotFoundResponse({
    description: ErrorMessages.SCHOOLS.NOT_FOUND,
    type: ErrorResponse,
  })
  findAdmins(@Param('id') id: string, @Query() query: PaginationQueryDto) {
    return this.schoolsService.findAdmins(id, query);
  }

  @Get(':id/vendors')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Role(UserRole.SUPER_ADMIN, UserRole.STUDENT, UserRole.PARENT)
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
  @Role(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'List students of a school' })
  @ApiSuccessResponse(SchoolStudentResponseDto)
  @ApiNotFoundResponse({
    description: ErrorMessages.SCHOOLS.NOT_FOUND,
    type: ErrorResponse,
  })
  @ApiForbiddenResponse({ description: 'Not your school', type: ErrorResponse })
  findStudents(@Param('id') id: string, @Query() query: PaginationQueryDto) {
    return this.schoolsService.findStudents(id, query);
  }

  @Get(':id/parents')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Role(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'List parents of a school' })
  @ApiSuccessResponse(SchoolParentResponseDto)
  @ApiNotFoundResponse({
    description: ErrorMessages.SCHOOLS.NOT_FOUND,
    type: ErrorResponse,
  })
  @ApiForbiddenResponse({ description: 'Not your school', type: ErrorResponse })
  findParents(@Param('id') id: string, @Query() query: PaginationQueryDto) {
    return this.schoolsService.findParents(id, query);
  }

  @Get(':id/stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Role(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({
    summary:
      'Get stats for a single school: revenue, order volume, students/vendors/parents counts',
  })
  @ApiSuccessResponse(SchoolStatsResponseDto)
  @ApiNotFoundResponse({
    description: ErrorMessages.SCHOOLS.NOT_FOUND,
    type: ErrorResponse,
  })
  @ApiForbiddenResponse({ description: 'Not your school', type: ErrorResponse })
  getSchoolStats(
    @Param('id') id: string,
    @CurrentUser() currentUser: { id: string; role: UserRole },
    @Query() query: StatsQueryDto,
  ) {
    return this.schoolsService.getSchoolStats(id, currentUser, query);
  }

  @Get(':id/transactions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Role(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'List transactions of a school with stats' })
  @ApiSuccessResponse(SchoolTransactionResponseDto)
  @ApiNotFoundResponse({
    description: ErrorMessages.SCHOOLS.NOT_FOUND,
    type: ErrorResponse,
  })
  @ApiForbiddenResponse({ description: 'Not your school', type: ErrorResponse })
  findTransactions(
    @Param('id') id: string,
    @Query() query: SchoolTransactionsQueryDto,
  ) {
    return this.schoolsService.findTransactions(id, query);
  }
}
