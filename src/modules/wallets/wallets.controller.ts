import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApiSuccessResponse } from '../../common/swagger/api-responses.decorator';
import { WalletsService } from './wallets.service';
import { WalletResponseDto } from './dto/wallet-response.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Role } from '../../common/decorators/role.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../users/user.types';
import { ErrorResponse } from '../../common/swagger/api-responses';
import { ErrorMessages } from '../../common/swagger/error-messages';

@ApiTags('Wallets')
@ApiBearerAuth()
@Controller({ version: '1', path: 'wallets' })
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  @Get('student/:studentId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Role(
    UserRole.SUPER_ADMIN,
    UserRole.SCHOOL_ADMIN,
    UserRole.PARENT,
    UserRole.STUDENT,
  )
  @ApiOperation({ summary: "Get a student's wallet" })
  @ApiSuccessResponse(WalletResponseDto)
  @ApiNotFoundResponse({
    description: ErrorMessages.WALLETS.NOT_FOUND,
    type: ErrorResponse,
  })
  @ApiForbiddenResponse({ description: 'Access denied', type: ErrorResponse })
  findByStudentId(
    @Param('studentId') studentId: string,
    @CurrentUser() currentUser: { id: string; role: UserRole },
  ) {
    return this.walletsService.findByStudentId(studentId, currentUser);
  }
}
