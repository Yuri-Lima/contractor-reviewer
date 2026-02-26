export type ImageAssetContext = 'avatar' | 'workspace_logo' | 'document_thumbnail';

export interface ImageAsset {
  id: string;
  context: ImageAssetContext;
  ownerId: string;
  storageKey: string;
  mimeType: string;
  width?: number;
  height?: number;
  sizeBytes: number;
  createdAt: string;
}

export interface ImageAssetStrategyConfig {
  context: ImageAssetContext;
  maxSizeBytes: number;
  maxWidth?: number;
  maxHeight?: number;
  allowedMimeTypes: readonly string[];
  pathPrefix: string;
  generateVariants?: { name: string; width: number; height?: number }[];
}
