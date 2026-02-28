import { Injectable } from '@nestjs/common';
import type { AssetContext } from '@contractai-review/shared';
import type { IAssetStrategy } from './interfaces/asset-strategy.interface';
import { AvatarStrategy } from './strategies/avatar.strategy';
import { WorkspaceLogoStrategy } from './strategies/workspace-logo.strategy';

@Injectable()
export class AssetStrategyRegistry {
  private readonly strategies = new Map<AssetContext, IAssetStrategy>();

  constructor(
    avatarStrategy: AvatarStrategy,
    workspaceLogoStrategy: WorkspaceLogoStrategy,
  ) {
    this.strategies.set('avatar', avatarStrategy);
    this.strategies.set('workspace_logo', workspaceLogoStrategy);
  }

  get(context: AssetContext): IAssetStrategy {
    const strategy = this.strategies.get(context);
    if (!strategy) {
      throw new Error(`No asset strategy registered for context: ${context}`);
    }
    return strategy;
  }
}
