import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LocalStorageService } from './local-storage.service';
import { S3StorageService } from './s3-storage.service';
import { IStorageService } from './storage.interface';
import { NoopMalwareScanner } from './malware-scanner.interface';

const STORAGE_SERVICE = 'STORAGE_SERVICE';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: STORAGE_SERVICE,
      useFactory: (configService: ConfigService): IStorageService => {
        const storageType = configService.get<string>('STORAGE_TYPE', 'local');
        const s3Endpoint = configService.get<string>('S3_ENDPOINT');
        const s3AccessKey = configService.get<string>('S3_ACCESS_KEY_ID');

        // Use S3 if endpoint and credentials are provided, otherwise use local
        if (storageType === 's3' && s3Endpoint && s3AccessKey) {
          return new S3StorageService(configService);
        }

        return new LocalStorageService(configService);
      },
      inject: [ConfigService],
    },
    LocalStorageService,
    S3StorageService,
    NoopMalwareScanner,
  ],
  exports: [STORAGE_SERVICE, NoopMalwareScanner],
})
export class StorageModule {}

// Export for injection
export { NoopMalwareScanner };

export const StorageServiceToken = STORAGE_SERVICE;
export type { IStorageService } from './storage.interface';
