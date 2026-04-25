import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request, Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(private readonly reflector: Reflector) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response: Response = ctx.getResponse();
    const request: Request = ctx.getRequest();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    if (status >= 500) {
      this.logger.error(
        `Unhandled exception on ${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const isValidationError =
      exception instanceof BadRequestException &&
      Array.isArray((exception.getResponse() as any)?.message);

    let message: string | string[];
    if (status >= 500) {
      message = 'Internal server error';
    } else if (isValidationError) {
      message = 'Invalid request';
    } else {
      message =
        exception instanceof Error ? exception.message : 'An error occurred';
    }

    response.status(status).json({ statusCode: status, message });
  }
}
