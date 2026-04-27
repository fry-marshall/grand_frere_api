import { BadRequestException } from '@nestjs/common';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { memoryStorage } from 'multer';

export interface FileUploadConfig {
  maxFiles: number;
  maxFileSizeBytes: number;
  allowedMimeTypes: string[];
}

export const FILE_CONFIGS = {
  ITEM_IMAGE: {
    maxFiles: 1,
    maxFileSizeBytes: 5 * 1024 * 1024, // 5 MB
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  },
} as const satisfies Record<string, FileUploadConfig>;

export function createMulterOptions(config: FileUploadConfig): MulterOptions {
  return {
    storage: memoryStorage(),
    limits: { files: config.maxFiles, fileSize: config.maxFileSizeBytes },
    fileFilter: (_req, file, callback) => {
      if (!config.allowedMimeTypes.includes(file.mimetype)) {
        return callback(
          new BadRequestException(
            `Invalid file type. Allowed: ${config.allowedMimeTypes.join(', ')}`,
          ),
          false,
        );
      }
      callback(null, true);
    },
  };
}
