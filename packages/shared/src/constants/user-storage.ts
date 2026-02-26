/**
 * User storage provider constants.
 * Shared across API and web apps for type-safe, non-hardcoded provider options.
 */
import type { StorageProvider } from '../types/user-storage';

export interface StorageProviderOption {
  value: StorageProvider;
  labelKey: string;
  credentialHelpKey: string;
}

export const STORAGE_PROVIDER_OPTIONS: readonly StorageProviderOption[] = [
  { value: 's3', labelKey: 'settings.providerS3', credentialHelpKey: 'settings.credentialHelpS3' },
  { value: 'r2', labelKey: 'settings.providerR2', credentialHelpKey: 'settings.credentialHelpR2' },
  {
    value: 'hetzner',
    labelKey: 'settings.providerHetzner',
    credentialHelpKey: 'settings.credentialHelpHetzner',
  },
] as const;
