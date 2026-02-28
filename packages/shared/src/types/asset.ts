export type AssetContext = 'avatar' | 'workspace_logo' | 'document_thumbnail';

/** @deprecated Use AssetContext */
export type ImageAssetContext = AssetContext;

export interface Asset {
  id: string;
  context: AssetContext;
  ownerId: string;
  storageKey: string;
  mimeType: string;
  width?: number;
  height?: number;
  sizeBytes: number;
  createdAt: string;
}

/** @deprecated Use Asset */
export interface ImageAsset extends Asset {}

export interface AssetStrategyConfig {
  context: AssetContext;
  maxSizeBytes: number;
  maxWidth?: number;
  maxHeight?: number;
  allowedMimeTypes: readonly string[];
  pathPrefix: string;
  generateVariants?: { name: string; width: number; height?: number }[];
}

/** @deprecated Use AssetStrategyConfig */
export interface ImageAssetStrategyConfig extends AssetStrategyConfig {}
