import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApiSuccessResponse } from '../../common/swagger/api-responses.decorator';
import { StudentsService } from './students.service';
import { StudentResponseDto } from './dto/student-response.dto';
import { UpdateStudentProfileDto } from './dto/update-student-profile.dto';
import { StudentParentResponseDto } from './dto/student-parents-response.dto';
import { StudentOrderResponseDto } from './dto/student-order-response.dto';
import { StudentTransactionResponseDto } from './dto/student-transaction-response.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Role } from '../../common/decorators/role.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ErrorResponse } from '../../common/swagger/api-responses';
import { ErrorMessages } from '../../common/swagger/error-messages';
import { UserRole } from '../users/user.types';

@ApiTags('Students')
@ApiBearerAuth()
@Controller({ version: '1', path: 'students' })
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Role(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'List students' })
  @ApiSuccessResponse(StudentResponseDto)
  findAll(
    @CurrentUser() currentUser: { id: string; role: UserRole },
    @Query() query: PaginationQueryDto,
  ) {
    return this.studentsService.findAll(currentUser, query);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Role(UserRole.STUDENT)
  @ApiOperation({ summary: 'Get current student profile' })
  @ApiSuccessResponse(StudentResponseDto)
  getMe(@CurrentUser() currentUser: { id: string; role: UserRole }) {
    return this.studentsService.findMe(currentUser.id);
  }

  @Put('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Role(UserRole.STUDENT)
  @ApiOperation({ summary: 'Update current student profile' })
  @ApiSuccessResponse(StudentResponseDto)
  updateMe(
    @Body() dto: UpdateStudentProfileDto,
    @CurrentUser() currentUser: { id: string; role: UserRole },
  ) {
    return this.studentsService.updateProfile(currentUser.id, dto);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Role(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.STUDENT)
  @ApiOperation({ summary: 'Get student by id' })
  @ApiSuccessResponse(StudentResponseDto)
  @ApiNotFoundResponse({
    description: ErrorMessages.STUDENTS.NOT_FOUND,
    type: ErrorResponse,
  })
  @ApiForbiddenResponse({ description: 'Access denied', type: ErrorResponse })
  findOne(
    @Param('id') id: string,
    @CurrentUser() currentUser: { id: string; role: UserRole },
  ) {
    return this.studentsService.findOne(id, currentUser);
  }

  @Get(':id/parents')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Role(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.STUDENT)
  @ApiOperation({ summary: "List student's parents" })
  @ApiSuccessResponse(StudentParentResponseDto)
  @ApiNotFoundResponse({
    description: ErrorMessages.STUDENTS.NOT_FOUND,
    type: ErrorResponse,
  })
  @ApiForbiddenResponse({ description: 'Access denied', type: ErrorResponse })
  findParents(
    @Param('id') id: string,
    @CurrentUser() currentUser: { id: string; role: UserRole },
  ) {
    return this.studentsService.findParents(id, currentUser);
  }

  @Get(':id/orders')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Role(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.STUDENT)
  @ApiOperation({ summary: "List student's orders" })
  @ApiSuccessResponse(StudentOrderResponseDto)
  @ApiNotFoundResponse({
    description: ErrorMessages.STUDENTS.NOT_FOUND,
    type: ErrorResponse,
  })
  @ApiForbiddenResponse({ description: 'Access denied', type: ErrorResponse })
  findOrders(
    @Param('id') id: string,
    @CurrentUser() currentUser: { id: string; role: UserRole },
    @Query() query: PaginationQueryDto,
  ) {
    return this.studentsService.findOrders(id, currentUser, query);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Role(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.PARENT)
  @ApiOperation({ summary: "Update a student's profile" })
  @ApiSuccessResponse(StudentResponseDto)
  @ApiNotFoundResponse({
    description: ErrorMessages.STUDENTS.NOT_FOUND,
    type: ErrorResponse,
  })
  @ApiForbiddenResponse({ description: 'Access denied', type: ErrorResponse })
  updateById(
    @Param('id') id: string,
    @CurrentUser() currentUser: { id: string; role: UserRole },
    @Body() dto: UpdateStudentProfileDto,
  ) {
    return this.studentsService.updateById(id, currentUser, dto);
  }

  @Get(':id/transactions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Role(
    UserRole.SUPER_ADMIN,
    UserRole.SCHOOL_ADMIN,
    UserRole.PARENT,
    UserRole.STUDENT,
  )
  @ApiOperation({ summary: "List student's wallet transactions" })
  @ApiSuccessResponse(StudentTransactionResponseDto)
  @ApiNotFoundResponse({
    description: ErrorMessages.STUDENTS.NOT_FOUND,
    type: ErrorResponse,
  })
  @ApiForbiddenResponse({ description: 'Access denied', type: ErrorResponse })
  findTransactions(
    @Param('id') id: string,
    @CurrentUser() currentUser: { id: string; role: UserRole },
    @Query() query: PaginationQueryDto,
  ) {
    return this.studentsService.findTransactions(id, currentUser, query);
  }
}
