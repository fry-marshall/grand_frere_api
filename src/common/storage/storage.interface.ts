export interface IStorageService {
  uploadBuffer(
    buffer: Buffer,
    key: string,
    contentType: string,
  ): Promise<string>;
  deleteFile(key: string): Promise<void>;
}

export const STORAGE_SERVICE = 'STORAGE_SERVICE';
