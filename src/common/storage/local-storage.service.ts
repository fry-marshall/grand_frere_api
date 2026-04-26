import { IStorageService } from './storage.interface';

export class LocalStorageService implements IStorageService {
  uploadBuffer(
    _buffer: Buffer,
    key: string,
    _contentType: string,
  ): Promise<string> {
    return Promise.resolve(`http://localhost/storage/${key}`);
  }

  deleteFile(_key: string): Promise<void> {
    return Promise.resolve();
  }
}
