import { Injectable } from '@nestjs/common';
import type { ImageAssetContext } from '@contractai-review/shared';
import type { IImageAssetStrategy } from './interfaces/image-asset-strategy.interface';
import { AvatarStrategy } from './strategies/avatar.strategy';
import { WorkspaceLogoStrategy } from './strategies/workspace-logo.strategy';

@Injectable()
export class ImageAssetStrategyRegistry {
  private readonly strategies = new Map<ImageAssetContext, IImageAssetStrategy>();

  constructor(
    avatarStrategy: AvatarStrategy,
    workspaceLogoStrategy: WorkspaceLogoStrategy,
  ) {
    this.strategies.set('avatar', avatarStrategy);
    this.strategies.set('workspace_logo', workspaceLogoStrategy);
  }

  get(context: ImageAssetContext): IImageAssetStrategy {
    const strategy = this.strategies.get(context);
    if (!strategy) {
      throw new Error(`No image strategy registered for context: ${context}`);
    }
    return strategy;
  }
}
