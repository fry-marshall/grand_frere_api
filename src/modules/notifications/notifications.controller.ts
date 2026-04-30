import { Controller, Get, Param, Put, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApiSuccessResponse } from '../../common/swagger/api-responses.decorator';
import { NotificationsService } from './notifications.service';
import { NotificationResponseDto } from './dto/notification-response.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Role } from '../../common/decorators/role.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../users/user.types';
import { ErrorResponse } from '../../common/swagger/api-responses';
import { ErrorMessages } from '../../common/swagger/error-messages';

@ApiTags('Notifications')
@Controller({ version: '1', path: 'notifications' })
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Role(UserRole.PARENT, UserRole.STUDENT, UserRole.VENDOR)
  @ApiOperation({ summary: 'List my notifications' })
  @ApiSuccessResponse(NotificationResponseDto)
  @ApiForbiddenResponse({ description: 'Access denied', type: ErrorResponse })
  findAll(
    @CurrentUser() currentUser: { id: string; role: UserRole },
    @Query() query: PaginationQueryDto,
  ) {
    return this.notificationsService.findAll(currentUser.id, query);
  }

  @Put(':id/read')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Role(UserRole.PARENT, UserRole.STUDENT, UserRole.VENDOR)
  @ApiOperation({ summary: 'Mark a notification as read' })
  @ApiSuccessResponse(NotificationResponseDto)
  @ApiNotFoundResponse({
    description: ErrorMessages.NOTIFICATIONS.NOT_FOUND,
    type: ErrorResponse,
  })
  @ApiForbiddenResponse({ description: 'Access denied', type: ErrorResponse })
  markRead(
    @Param('id') id: string,
    @CurrentUser() currentUser: { id: string; role: UserRole },
  ) {
    return this.notificationsService.markRead(id, currentUser.id);
  }

  @Put('read-all')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Role(UserRole.PARENT, UserRole.STUDENT, UserRole.VENDOR)
  @ApiOperation({ summary: 'Mark all my notifications as read' })
  @ApiSuccessResponse(NotificationResponseDto)
  @ApiForbiddenResponse({ description: 'Access denied', type: ErrorResponse })
  markAllRead(@CurrentUser() currentUser: { id: string; role: UserRole }) {
    return this.notificationsService.markAllRead(currentUser.id);
  }
}
