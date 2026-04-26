import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { STORAGE_SERVICE } from './storage.interface';
import { SpacesStorageService } from './spaces-storage.service';
import { LocalStorageService } from './local-storage.service';

@Global()
@Module({
  providers: [
    {
      provide: STORAGE_SERVICE,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        config.get('NODE_ENV') === 'prod'
          ? new SpacesStorageService(config)
          : new LocalStorageService(),
    },
  ],
  exports: [STORAGE_SERVICE],
})
export class StorageModule {}
