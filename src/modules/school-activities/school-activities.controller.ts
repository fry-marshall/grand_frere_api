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
  UploadedFiles,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
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
import { SchoolActivitiesService } from './school-activities.service';
import { CreateSchoolActivityDto } from './dto/create-school-activity.dto';
import { UpdateSchoolActivityDto } from './dto/update-school-activity.dto';
import { SchoolActivityResponseDto } from './dto/school-activity-response.dto';
import { SchoolActivitiesQueryDto } from './dto/school-activities-query.dto';
import {
  FILE_CONFIGS,
  createMulterOptions,
} from '../../common/multer/multer.config';
import { MulterExceptionFilter } from '../../common/multer/multer-exception.filter';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Role } from '../../common/decorators/role.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ErrorResponse } from '../../common/swagger/api-responses';
import { ErrorMessages } from '../../common/swagger/error-messages';
import { UserRole } from '../users/user.types';

@ApiTags('School Activities')
@Controller({ version: '1', path: 'school-activities' })
export class SchoolActivitiesController {
  constructor(
    private readonly schoolActivitiesService: SchoolActivitiesService,
  ) {}

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Role(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
  @UseInterceptors(
    FilesInterceptor(
      'photos[]',
      FILE_CONFIGS.SCHOOL_ACTIVITY_PHOTOS.maxFiles,
      createMulterOptions(FILE_CONFIGS.SCHOOL_ACTIVITY_PHOTOS),
    ),
  )
  @UseFilters(MulterExceptionFilter)
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: CreateSchoolActivityDto })
  @ApiOperation({
    summary: 'Create a school activity (created as a draft, not visible)',
  })
  @ApiSuccessResponse(SchoolActivityResponseDto, 201)
  @ApiBadRequestResponse({
    description: 'Validation failed',
    type: ErrorResponse,
  })
  @ApiNotFoundResponse({
    description: ErrorMessages.SCHOOLS.NOT_FOUND,
    type: ErrorResponse,
  })
  create(
    @Body() dto: CreateSchoolActivityDto,
    @UploadedFiles() photos: Express.Multer.File[],
    @CurrentUser() currentUser: { id: string; role: UserRole },
  ) {
    return this.schoolActivitiesService.create(dto, photos, currentUser);
  }

  @Put(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Role(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
  @UseInterceptors(
    FilesInterceptor(
      'photos[]',
      FILE_CONFIGS.SCHOOL_ACTIVITY_PHOTOS.maxFiles,
      createMulterOptions(FILE_CONFIGS.SCHOOL_ACTIVITY_PHOTOS),
    ),
  )
  @UseFilters(MulterExceptionFilter)
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UpdateSchoolActivityDto })
  @ApiOperation({
    summary:
      'Update a school activity. If photos are sent, they fully replace the existing set.',
  })
  @ApiSuccessResponse(SchoolActivityResponseDto)
  @ApiBadRequestResponse({
    description: 'Validation failed',
    type: ErrorResponse,
  })
  @ApiNotFoundResponse({
    description: ErrorMessages.SCHOOL_ACTIVITIES.NOT_FOUND,
    type: ErrorResponse,
  })
  @ApiForbiddenResponse({ description: 'Not your school', type: ErrorResponse })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSchoolActivityDto,
    @UploadedFiles() photos: Express.Multer.File[],
    @CurrentUser() currentUser: { id: string; role: UserRole },
  ) {
    return this.schoolActivitiesService.update(id, dto, photos, currentUser);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Role(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete a school activity' })
  @ApiNoContentResponse({ description: 'Activity deleted' })
  @ApiNotFoundResponse({
    description: ErrorMessages.SCHOOL_ACTIVITIES.NOT_FOUND,
    type: ErrorResponse,
  })
  @ApiForbiddenResponse({ description: 'Not your school', type: ErrorResponse })
  remove(
    @Param('id') id: string,
    @CurrentUser() currentUser: { id: string; role: UserRole },
  ) {
    return this.schoolActivitiesService.remove(id, currentUser);
  }

  @Put(':id/publish')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Role(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Make a school activity visible' })
  @ApiSuccessResponse(SchoolActivityResponseDto)
  @ApiNotFoundResponse({
    description: ErrorMessages.SCHOOL_ACTIVITIES.NOT_FOUND,
    type: ErrorResponse,
  })
  @ApiForbiddenResponse({ description: 'Not your school', type: ErrorResponse })
  @ApiConflictResponse({
    description: ErrorMessages.SCHOOL_ACTIVITIES.NOT_PUBLISHABLE,
    type: ErrorResponse,
  })
  publish(
    @Param('id') id: string,
    @CurrentUser() currentUser: { id: string; role: UserRole },
  ) {
    return this.schoolActivitiesService.publish(id, currentUser);
  }

  @Put(':id/hide')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Role(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Hide a school activity' })
  @ApiSuccessResponse(SchoolActivityResponseDto)
  @ApiNotFoundResponse({
    description: ErrorMessages.SCHOOL_ACTIVITIES.NOT_FOUND,
    type: ErrorResponse,
  })
  @ApiForbiddenResponse({ description: 'Not your school', type: ErrorResponse })
  @ApiConflictResponse({
    description: ErrorMessages.SCHOOL_ACTIVITIES.NOT_HIDABLE,
    type: ErrorResponse,
  })
  hide(
    @Param('id') id: string,
    @CurrentUser() currentUser: { id: string; role: UserRole },
  ) {
    return this.schoolActivitiesService.hide(id, currentUser);
  }

  @Get('mine')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Role(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary:
      'List activities for management (draft + published). SCHOOL_ADMIN is scoped to their own school.',
  })
  @ApiSuccessResponse(SchoolActivityResponseDto)
  findMine(
    @Query() query: SchoolActivitiesQueryDto,
    @CurrentUser() currentUser: { id: string; role: UserRole },
  ) {
    return this.schoolActivitiesService.findMine(query, currentUser);
  }

  @Get()
  @ApiOperation({
    summary:
      'List published school activities (public). Optional ?schoolId= filter.',
  })
  @ApiSuccessResponse(SchoolActivityResponseDto)
  findAll(@Query() query: SchoolActivitiesQueryDto) {
    return this.schoolActivitiesService.findAllPublic(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a published school activity (public)' })
  @ApiSuccessResponse(SchoolActivityResponseDto)
  @ApiNotFoundResponse({
    description: ErrorMessages.SCHOOL_ACTIVITIES.NOT_FOUND,
    type: ErrorResponse,
  })
  findOne(@Param('id') id: string) {
    return this.schoolActivitiesService.findOnePublic(id);
  }
}
