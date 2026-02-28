import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import { join } from 'path';
import { IStorageService, StorageOptions } from './storage.interface';

@Injectable()
export class LocalStorageService implements IStorageService {
  private readonly storagePath: string;

  constructor(private configService: ConfigService) {
    // Use local storage directory, default to ./storage
    this.storagePath = this.configService.get<string>('STORAGE_PATH') || './storage';
    this.ensureStorageDirectory();
  }

  private async ensureStorageDirectory() {
    try {
      await fs.access(this.storagePath);
    } catch {
      await fs.mkdir(this.storagePath, { recursive: true });
    }
  }

  private getFilePath(workspaceId: string, documentId: string, fileName: string): string {
    // Structure: storage/workspaceId/documentId/filename
    return join(this.storagePath, workspaceId, documentId, fileName);
  }

  async uploadFile(
    file: Buffer,
    fileName: string,
    mimeType: string,
    workspaceId: string,
    documentId: string,
    _options?: StorageOptions,
  ): Promise<string> {
    const filePath = this.getFilePath(workspaceId, documentId, fileName);
    const dir = join(this.storagePath, workspaceId, documentId);

    // Ensure directory exists
    await fs.mkdir(dir, { recursive: true });

    // Write file
    await fs.writeFile(filePath, file);

    // Return storage key (relative path from storage root)
    return `${workspaceId}/${documentId}/${fileName}`;
  }

  async getFileUrl(storageKey: string, expiresIn?: number): Promise<string> {
    // For local storage, return file path
    // In production, this would be served via a static file endpoint
    return `/api/storage/${storageKey}`;
  }

  async deleteFile(storageKey: string): Promise<void> {
    const filePath = join(this.storagePath, storageKey);
    try {
      await fs.unlink(filePath);
      // Try to remove empty directories
      const dir = join(filePath, '..');
      try {
        await fs.rmdir(dir);
      } catch {
        // Directory not empty or doesn't exist, ignore
      }
    } catch (error) {
      // File doesn't exist, ignore
    }
  }

  async fileExists(storageKey: string): Promise<boolean> {
    try {
      const filePath = join(this.storagePath, storageKey);
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async getFileSize(storageKey: string): Promise<number> {
    const filePath = join(this.storagePath, storageKey);
    const stats = await fs.stat(filePath);
    return stats.size;
  }

  async getFileBuffer(storageKey: string, _options?: StorageOptions): Promise<Buffer> {
    const filePath = join(this.storagePath, storageKey);
    return await fs.readFile(filePath);
  }
}
