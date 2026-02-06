import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { IStorageService } from './storage.interface';

@Injectable()
export class S3StorageService implements IStorageService {
  private readonly s3Client: S3Client;
  private readonly bucket: string;

  constructor(private configService: ConfigService) {
    const endpoint = this.configService.get<string>('S3_ENDPOINT');
    const region = this.configService.get<string>('S3_REGION') || 'us-east-1';
    const accessKeyId = this.configService.get<string>('S3_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>('S3_SECRET_ACCESS_KEY');

    this.bucket = this.configService.get<string>('S3_BUCKET') || 'contractai';

    this.s3Client = new S3Client({
      region,
      endpoint,
      credentials: accessKeyId && secretAccessKey
        ? {
            accessKeyId,
            secretAccessKey,
          }
        : undefined,
      forcePathStyle: !!endpoint, // Required for S3-compatible services like R2
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

  async getFileUrl(storageKey: string, expiresIn: number = 3600): Promise<string> {
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

  async getFileBuffer(storageKey: string): Promise<Buffer> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: storageKey,
    });

    const response = await this.s3Client.send(command);
    if (!response.Body) {
      throw new Error(`File not found: ${storageKey}`);
    }

    // Convert stream to buffer
    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as any) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }
}
