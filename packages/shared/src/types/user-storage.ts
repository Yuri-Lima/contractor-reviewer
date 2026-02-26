// Credentials shape per provider - extensible for future providers
// AWS: IAM access keys (IAM Console) or STS temporary credentials (sessionToken)
// R2: API token → Access Key ID + Secret Access Key (Manage R2 API tokens in dashboard)
// Hetzner: Security → S3 Credentials → Generate credentials (access key + secret key)
export interface S3Credentials {
  accessKeyId: string;
  secretAccessKey: string;
  /** Optional. AWS STS / R2 temp credentials use this. */
  sessionToken?: string;
}

export interface R2Credentials extends S3Credentials {
  // R2: Create via "Manage R2 API tokens" → Access Key ID (Client ID) + Secret Access Key (Client Secret)
}

export interface HetznerCredentials extends S3Credentials {
  // Hetzner: Security → S3 Credentials → Generate (access key + secret key, secret shown only once)
}

export type StorageProvider = 's3' | 'r2' | 'hetzner';

// Union for flexibility - add GCS, Azure, etc. later
export type StorageCredentials = S3Credentials | R2Credentials | HetznerCredentials;

export interface UserStorageConfig {
  provider: StorageProvider;
  endpoint: string;
  region: string;
  bucket: string;
}

export interface UserStorageConfigWithCredentials extends UserStorageConfig {
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
