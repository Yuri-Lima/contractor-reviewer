/**
 * Storage interface for S3/R2 compatible storage
 * Allows switching between S3/R2 and local filesystem for development
 */
export interface IStorageService {
  /**
   * Upload a file and return the storage key
   */
  uploadFile(
    file: Buffer,
    fileName: string,
    mimeType: string,
    workspaceId: string,
    documentId: string,
  ): Promise<string>;

  /**
   * Get a file download URL (presigned for S3/R2, file path for local)
   */
  getFileUrl(storageKey: string, expiresIn?: number): Promise<string>;

  /**
   * Delete a file
   */
  deleteFile(storageKey: string): Promise<void>;

  /**
   * Check if file exists
   */
  fileExists(storageKey: string): Promise<boolean>;

  /**
   * Get file size
   */
  getFileSize(storageKey: string): Promise<number>;

  /**
   * Get file as Buffer
   */
  getFileBuffer(storageKey: string): Promise<Buffer>;
}
