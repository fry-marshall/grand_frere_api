import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';
import { IStorageService } from './storage.interface';

export class SpacesStorageService implements IStorageService {
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly region: string;

  constructor(config: ConfigService) {
    this.region = config.getOrThrow<string>('DO_SPACES_REGION');
    this.bucket = config.getOrThrow<string>('DO_SPACES_BUCKET');

    this.s3 = new S3Client({
      endpoint: config.getOrThrow<string>('DO_SPACES_ENDPOINT'),
      region: this.region,
      credentials: {
        accessKeyId: config.getOrThrow<string>('DO_SPACES_KEY'),
        secretAccessKey: config.getOrThrow<string>('DO_SPACES_SECRET'),
      },
      forcePathStyle: false,
    });
  }

  async uploadBuffer(
    buffer: Buffer,
    key: string,
    contentType: string,
  ): Promise<string> {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        ACL: 'public-read',
      }),
    );
    return this.getPublicUrl(key);
  }

  async deleteFile(key: string): Promise<void> {
    await this.s3.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  getPublicUrl(key: string): string {
    return `https://${this.bucket}.${this.region}.digitaloceanspaces.com/${key}`;
  }
}
