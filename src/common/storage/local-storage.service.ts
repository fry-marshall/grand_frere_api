import { IStorageService } from './storage.interface';

export class LocalStorageService implements IStorageService {
  uploadBuffer(
    _buffer: Buffer,
    key: string,
    _contentType: string,
  ): Promise<string> {
    return Promise.resolve(this.getPublicUrl(key));
  }

  deleteFile(_key: string): Promise<void> {
    return Promise.resolve();
  }

  getPublicUrl(key: string): string {
    return `http://localhost/storage/${key}`;
  }
}
