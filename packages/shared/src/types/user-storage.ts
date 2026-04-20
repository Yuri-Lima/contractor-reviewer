export type StorageProvider = 's3' | 'r2' | 'hetzner';

export interface StorageCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
}

export interface UserStorageConfigWithCredentials {
  provider: StorageProvider;
  endpoint: string;
  region: string;
  bucket: string;
  credentials: StorageCredentials;
}

// API: request (credentials included) and response (masked, no secrets)
export interface UpdateUserStorageRequest {
  provider: StorageProvider;
  endpoint: string;
  region: string;
  bucket: string;
  credentials: StorageCredentials;
}

export interface UserStorageConfigResponse {
  configured: boolean;
  provider?: StorageProvider;
  endpoint?: string;
  region?: string;
  bucket?: string;
}
