import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ImageAsset } from '../entities/image-asset.entity';
import { StorageModule } from '../storage/storage.module';
import { UserStorageModule } from '../storage/user-storage.module';
import { ImageManagerService } from './image-manager.service';
import { ImageAssetStrategyRegistry } from './image-asset-strategy.registry';
import { AvatarStrategy } from './strategies/avatar.strategy';
import { WorkspaceLogoStrategy } from './strategies/workspace-logo.strategy';

@Module({
  imports: [
    TypeOrmModule.forFeature([ImageAsset]),
    StorageModule,
    UserStorageModule,
  ],
  providers: [
    AvatarStrategy,
    WorkspaceLogoStrategy,
    ImageAssetStrategyRegistry,
    ImageManagerService,
  ],
  exports: [ImageManagerService, ImageAssetStrategyRegistry],
})
export class ImageManagerModule {}
