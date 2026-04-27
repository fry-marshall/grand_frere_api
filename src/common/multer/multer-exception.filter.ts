import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { MulterError } from 'multer';

@Catch(MulterError)
export class MulterExceptionFilter implements ExceptionFilter {
  catch(exception: MulterError, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();

    let message = 'File upload error';
    let status = HttpStatus.BAD_REQUEST;

    if (exception.code === 'LIMIT_FILE_SIZE') {
      message = 'File is too large';
    } else if (exception.code === 'LIMIT_FILE_COUNT') {
      message = 'Too many files';
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      message = exception.message;
    }

    res.status(status).json({ success: false, message });
  }
}
