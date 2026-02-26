import { Injectable, Inject } from '@nestjs/common';
import { StorageServiceToken } from './storage.module';
import type { IStorageService } from './storage.interface';
import { UserS3StorageAdapter } from './user-s3-storage.adapter';
import { UserStorageService } from './user-storage.service';

@Injectable()
export class StorageResolverService {
  constructor(
    private readonly userStorageService: UserStorageService,
    @Inject(StorageServiceToken)
    private readonly defaultStorage: IStorageService,
  ) {}

  async getStorageForUser(userId: string): Promise<IStorageService> {
    const config = await this.userStorageService.getDecryptedConfigForUser(userId);
    if (!config?.credentials?.accessKeyId || !config?.credentials?.secretAccessKey) {
      return this.defaultStorage;
    }
    return new UserS3StorageAdapter(config);
  }
}
