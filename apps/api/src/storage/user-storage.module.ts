import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserStorageSettings } from '../entities/user-storage-settings.entity';
import { StorageModule } from './storage.module';
import { UserStorageService } from './user-storage.service';
import { StorageResolverService } from './storage-resolver.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserStorageSettings]),
    StorageModule,
  ],
  providers: [UserStorageService, StorageResolverService],
  exports: [UserStorageService, StorageResolverService],
})
export class UserStorageModule {}
