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
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApiSuccessResponse } from '../../common/swagger/api-responses.decorator';
import { SchoolJoinRequestsService } from './school-join-requests.service';
import { SubmitSchoolJoinRequestDto } from './dto/submit-school-join-request.dto';
import { ApproveSchoolJoinRequestDto } from './dto/approve-school-join-request.dto';
import { RejectSchoolJoinRequestDto } from './dto/reject-school-join-request.dto';
import { SchoolJoinRequestResponseDto } from './dto/school-join-request-response.dto';
import { ApproveSchoolJoinRequestResponseDto } from './dto/approve-school-join-request-response.dto';
import { SchoolJoinRequestsQueryDto } from './dto/school-join-requests-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Role } from '../../common/decorators/role.decorator';
import { ErrorResponse } from '../../common/swagger/api-responses';
import { ErrorMessages } from '../../common/swagger/error-messages';
import { UserRole } from '../users/user.types';

@ApiTags('School Join Requests')
@Controller({ version: '1', path: 'school-join-requests' })
export class SchoolJoinRequestsController {
  constructor(
    private readonly schoolJoinRequestsService: SchoolJoinRequestsService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Submit a request to join the schools network' })
  @ApiSuccessResponse(SchoolJoinRequestResponseDto, 201)
  @ApiBadRequestResponse({
    description: 'Validation failed',
    type: ErrorResponse,
  })
  submit(@Body() dto: SubmitSchoolJoinRequestDto) {
    return this.schoolJoinRequestsService.submit(dto);
  }

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Role(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'List school join requests' })
  @ApiSuccessResponse(SchoolJoinRequestResponseDto)
  findAll(@Query() query: SchoolJoinRequestsQueryDto) {
    return this.schoolJoinRequestsService.findAll(query);
  }

  @Get(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Role(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get a school join request' })
  @ApiSuccessResponse(SchoolJoinRequestResponseDto)
  @ApiNotFoundResponse({
    description: ErrorMessages.SCHOOL_JOIN_REQUESTS.NOT_FOUND,
    type: ErrorResponse,
  })
  findOne(@Param('id') id: string) {
    return this.schoolJoinRequestsService.findOne(id);
  }

  @Put(':id/approve')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Role(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Approve a join request — creates the school and its admin',
  })
  @ApiSuccessResponse(ApproveSchoolJoinRequestResponseDto)
  @ApiBadRequestResponse({
    description: 'Validation failed',
    type: ErrorResponse,
  })
  @ApiNotFoundResponse({
    description: ErrorMessages.SCHOOL_JOIN_REQUESTS.NOT_FOUND,
    type: ErrorResponse,
  })
  @ApiConflictResponse({
    description:
      'Request already processed / sigle already exists / phone already exists',
    type: ErrorResponse,
  })
  approve(@Param('id') id: string, @Body() dto: ApproveSchoolJoinRequestDto) {
    return this.schoolJoinRequestsService.approve(id, dto);
  }

  @Put(':id/reject')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Role(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Reject a join request' })
  @ApiSuccessResponse(SchoolJoinRequestResponseDto)
  @ApiNotFoundResponse({
    description: ErrorMessages.SCHOOL_JOIN_REQUESTS.NOT_FOUND,
    type: ErrorResponse,
  })
  @ApiConflictResponse({
    description: ErrorMessages.SCHOOL_JOIN_REQUESTS.NOT_PENDING,
    type: ErrorResponse,
  })
  reject(@Param('id') id: string, @Body() dto: RejectSchoolJoinRequestDto) {
    return this.schoolJoinRequestsService.reject(id, dto);
  }
}
