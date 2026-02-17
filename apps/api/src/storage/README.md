# Storage Module

Módulo de armazenamento com suporte para S3/R2 e armazenamento local.

## Configuração

### Local Storage (Desenvolvimento)

```env
STORAGE_TYPE=local
STORAGE_PATH=./storage
```

### S3/R2 (Produção)

```env
STORAGE_TYPE=s3
S3_ENDPOINT=https://your-s3-endpoint.com
S3_REGION=us-east-1
S3_BUCKET=contractai
S3_ACCESS_KEY_ID=your-access-key
S3_SECRET_ACCESS_KEY=your-secret-key
```

## Validações de Upload

- **Tamanho máximo:** 25MB
- **Extensões permitidas:** `.pdf`, `.doc`, `.docx`, `.txt`, `.md`, `.png`, `.jpg`, `.jpeg`
- **MIME types:** `application/pdf`, `application/msword` (.doc), `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (.docx), `text/plain`, `text/markdown`, `text/x-markdown`, `image/png`, `image/jpeg`
- **MIME sniffing (segurança):** Validação por assinatura de arquivo (magic numbers) — não confia no header Content-Type. Rejeita arquivos cuja assinatura não corresponda ao tipo declarado.
- **Malware scanning:** Interface preparada para ClamAV (atualmente noop)

## Estrutura de Armazenamento

```
storage/
  {workspaceId}/
    {documentId}/
      {fileName}
```

## Uso

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
