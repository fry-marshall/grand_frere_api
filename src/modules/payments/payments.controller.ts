import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApiSuccessResponse } from '../../common/swagger/api-responses.decorator';
import { PaymentsService } from './payments.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { InitiatePaymentResponseDto } from './dto/initiate-payment-response.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Role } from '../../common/decorators/role.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../users/user.types';
import { ErrorResponse } from '../../common/swagger/api-responses';
import { ErrorMessages } from '../../common/swagger/error-messages';

@ApiTags('Payments')
@Controller({ version: '1', path: 'payments' })
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('initiate')
  @HttpCode(201)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Role(UserRole.SUPER_ADMIN, UserRole.PARENT, UserRole.STUDENT)
  @ApiOperation({ summary: 'Initiate a wallet top-up via Paystack' })
  @ApiSuccessResponse(InitiatePaymentResponseDto)
  @ApiNotFoundResponse({
    description: ErrorMessages.STUDENTS.NOT_FOUND,
    type: ErrorResponse,
  })
  @ApiForbiddenResponse({ description: 'Access denied', type: ErrorResponse })
  initiate(
    @Body() dto: InitiatePaymentDto,
    @CurrentUser() currentUser: { id: string; role: UserRole },
  ) {
    return this.paymentsService.initiate(dto, currentUser);
  }

  @Post('webhook')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Paystack webhook — confirms payment and credits wallet',
  })
  @ApiOkResponse({ description: 'Webhook processed' })
  async webhook(@Req() req: any, @Body() body: Record<string, unknown>) {
    const signature = req.headers['x-paystack-signature'] as string;
    const rawBody: Buffer = req.rawBody;
    return this.paymentsService.handleWebhook(rawBody, signature, body);
  }
}
