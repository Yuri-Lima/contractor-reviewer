/**
 * Image asset upload constants.
 * Used by ImageManager for validation (PNG, JPEG).
 */
export const IMAGE_ASSET_EXTENSIONS = ['.png', '.jpg', '.jpeg'] as const;

export const IMAGE_ASSET_MIME_TYPES = [
  'image/png',
  'image/jpeg',
] as const;

/** HTML accept attribute value for image file inputs */
export const IMAGE_ASSET_INPUT_ACCEPT = IMAGE_ASSET_EXTENSIONS.join(',');
