import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ImageAsset } from '../entities/image-asset.entity';
import { FileTypeModule } from '../file-type/file-type.module';
import { StorageModule } from '../storage/storage.module';
import { UserStorageModule } from '../storage/user-storage.module';
import { AssetManagerService } from './asset-manager.service';
import { AssetStrategyRegistry } from './asset-strategy.registry';
import { AvatarStrategy } from './strategies/avatar.strategy';
import { WorkspaceLogoStrategy } from './strategies/workspace-logo.strategy';

@Module({
  imports: [
    TypeOrmModule.forFeature([ImageAsset]),
    FileTypeModule,
    StorageModule,
    UserStorageModule,
  ],
  providers: [
    AvatarStrategy,
    WorkspaceLogoStrategy,
    AssetStrategyRegistry,
    AssetManagerService,
  ],
  exports: [AssetManagerService, AssetStrategyRegistry],
})
export class AssetManagerModule {}
