import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { UserStorageConfigWithCredentials } from '@contractai-review/shared';
import type { IStorageService, StorageOptions } from './storage.interface';

/**
 * S3/R2-compatible storage adapter that uses user-provided credentials.
 * Implements IStorageService for use with Image Manager.
 */
export class UserS3StorageAdapter implements IStorageService {
  private readonly s3Client: S3Client;
  private readonly bucket: string;

  constructor(config: UserStorageConfigWithCredentials) {
    const { endpoint, region, bucket, credentials } = config;
    this.bucket = bucket;
    const creds: { accessKeyId: string; secretAccessKey: string; sessionToken?: string } = {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
    };
    if (credentials.sessionToken) {
      creds.sessionToken = credentials.sessionToken;
    }
    this.s3Client = new S3Client({
      region: region || 'us-east-1',
      endpoint: endpoint || undefined,
      credentials: creds,
      forcePathStyle: !!endpoint,
    });
  }

  private getStorageKey(workspaceId: string, documentId: string, fileName: string): string {
    return `${workspaceId}/${documentId}/${fileName}`;
  }

  async uploadFile(
    file: Buffer,
    fileName: string,
    mimeType: string,
    workspaceId: string,
    documentId: string,
    _options?: StorageOptions,
  ): Promise<string> {
    const storageKey = this.getStorageKey(workspaceId, documentId, fileName);
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: storageKey,
      Body: file,
      ContentType: mimeType,
    });
    await this.s3Client.send(command);
    return storageKey;
  }

  async getFileUrl(storageKey: string, expiresIn = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: storageKey,
    });
    return getSignedUrl(this.s3Client, command, { expiresIn });
  }

  async deleteFile(storageKey: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: storageKey,
    });
    await this.s3Client.send(command);
  }

  async fileExists(storageKey: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
      });
      await this.s3Client.send(command);
      return true;
    } catch {
      return false;
    }
  }

  async getFileSize(storageKey: string): Promise<number> {
    const command = new HeadObjectCommand({
      Bucket: this.bucket,
      Key: storageKey,
    });
    const response = await this.s3Client.send(command);
    return response.ContentLength || 0;
  }

  async getFileBuffer(storageKey: string, _options?: StorageOptions): Promise<Buffer> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: storageKey,
    });
    const response = await this.s3Client.send(command);
    if (!response.Body) {
      throw new Error(`File not found: ${storageKey}`);
    }
    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }
}
