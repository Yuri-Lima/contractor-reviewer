# Storage Module

Storage module with support for S3/R2 and local storage.

## Configuration

### Local Storage (Development)

```env
STORAGE_TYPE=local
STORAGE_PATH=./storage
```

### S3/R2 (Production)

```env
STORAGE_TYPE=s3
S3_ENDPOINT=https://your-s3-endpoint.com
S3_REGION=us-east-1
S3_BUCKET=contractai
S3_ACCESS_KEY_ID=your-access-key
S3_SECRET_ACCESS_KEY=your-secret-key
```

## Upload Validations

Constants are the single source of truth — defined in `packages/shared/src/constants/upload.ts` and consumed by both API validators and the frontend file input.

- **Max size per file:** 50MB (`MAX_FILE_SIZE_BYTES`)
- **Max batch size:** 100MB total (`MAX_BATCH_SIZE_BYTES`), up to 20 files (`MAX_BATCH_FILE_COUNT`)
- **Allowed extensions:** `.pdf`, `.doc`, `.docx`, `.pptx`, `.xlsx`, `.txt`, `.md`, `.png`, `.jpg`, `.jpeg`, `.tiff`, `.tif`, `.bmp`, `.webp`
- **MIME types:** `application/pdf`, `application/x-pdf`, `application/msword` (.doc), `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (.docx), `application/vnd.openxmlformats-officedocument.presentationml.presentation` (.pptx), `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` (.xlsx), `text/plain`, `text/markdown`, `text/x-markdown`, `image/png`, `image/jpeg`, `image/tiff`, `image/bmp`, `image/webp`
- **MIME sniffing (security):** Validation by file signature (magic numbers) — does not trust the Content-Type header. Rejects files whose signature does not match the declared type.
- **Malware scanning:** Interface prepared for ClamAV (currently noop, gated by `MALWARE_SCAN_ENABLED`).

## Storage Structure

```
storage/
  {workspaceId}/
    {documentId}/
      {fileName}
```

## Usage

```typescript
@Inject(StorageServiceToken)
private storageService: IStorageService;

// Upload
const storageKey = await this.storageService.uploadFile(
  buffer,
  fileName,
  mimeType,
  workspaceId,
  documentId,
);

// Download URL
const url = await this.storageService.getFileUrl(storageKey);

// Delete
await this.storageService.deleteFile(storageKey);
```

## Location

- **Implementation:** `apps/api/src/storage/`
- **README:** `apps/api/src/storage/README.md` (links here)
