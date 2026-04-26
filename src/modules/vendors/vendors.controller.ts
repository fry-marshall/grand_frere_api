import { Controller, Param, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApiSuccessResponse } from '../../common/swagger/api-responses.decorator';
import { VendorsService } from './vendors.service';
import { VendorResponseDto } from './dto/vendor-response.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Role } from '../../common/decorators/role.decorator';
import { ErrorResponse } from '../../common/swagger/api-responses';
import { ErrorMessages } from '../../common/swagger/error-messages';
import { UserRole } from '../users/user.types';

@ApiTags('Vendors')
@ApiBearerAuth()
@Controller({ version: '1', path: 'vendors' })
export class VendorsController {
  constructor(private readonly vendorsService: VendorsService) {}

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
