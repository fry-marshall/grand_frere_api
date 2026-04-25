import { applyDecorators } from '@nestjs/common';
import { ApiForbiddenResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { ErrorResponse } from './api-responses';

export const ApiAuthResponses = () =>
  applyDecorators(
    ApiUnauthorizedResponse({
      description: 'Missing or invalid token',
      type: ErrorResponse,
    }),
    ApiForbiddenResponse({
      description: 'Insufficient role',
      type: ErrorResponse,
    }),
  );
