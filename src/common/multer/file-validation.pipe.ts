import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

interface FileValidationOptions {
  required?: boolean;
}

@Injectable()
export class FileValidationPipe implements PipeTransform {
  constructor(private readonly options: FileValidationOptions = {}) {}

  transform(file: Express.Multer.File | undefined) {
    if (this.options.required && !file) {
      throw new BadRequestException('A file is required');
    }
    return file;
  }
}
