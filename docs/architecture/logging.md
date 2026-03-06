# Backend Logging and Flow Tracking

Backend logging strategy for developers to track request flows and debug issues. All logs use metadata only—never document content, chunks, or user messages.

## LOG_LEVEL Environment Variable

Control log verbosity via `LOG_LEVEL`:

| Value | What shows |
|-------|------------|
| `off` | No NestJS logs |
| `error` | Only `logger.error()` |
| `warn` | `logger.warn()` + error |
| `log` / `info` | `logger.log()` + warn + error |
| `debug` | `logger.debug()` + log + warn + error |
| `verbose` | All levels |

**Production**: Set `LOG_LEVEL=warn` or `LOG_LEVEL=error` to reduce flow-tracking logs. Use `LOG_LEVEL=off` to disable NestJS logging entirely.

**Development**: Use `LOG_LEVEL=debug` or `LOG_LEVEL=verbose` for full flow tracking.

**Default**: `log` in production (`NODE_ENV=production`), `debug` in development.

Configure in `.env`:

```
LOG_LEVEL=debug
```

For Docker deployments, set in `deploy/docker-compose.yml` env or `.env`; the API and worker both respect `LOG_LEVEL`.

## Log Prefixes (grep-ability)

Logs use consistent prefixes for filtering:

| Prefix | Flow |
|--------|------|
| `[UploadFile]` | Document upload pipeline |
| `[CreateDocument]`, `[GetDocument]`, `[DeleteDocument]` | Document CRUD |
| `[Chat]`, `[ChatStream]`, `[ChatPrepare]`, `[ChatExecute]` | Chat/RAG |
| `[RAG]` | RAG service (generateAnswer, cache, vector search, execute) |
| `[GenerateRedline]`, `[ApplyRedline]` | Redline flow |
| `[Redline]` | RedlineService generation |
| `[Version]` | Version creation |
| `[DeleteDocument]` | Document deletion orchestrator |
| `[Parsing]`, `[Embeddings]`, `[PROGRESS]` | BullMQ workers |
| `[VectorSearch]` | pgvector queries |
| `[WorkspaceGuard]` | Workspace access |

## Main Flows and Log Points

### 1. Document Upload Pipeline

```
DocumentsController.uploadFile → DocumentsService.uploadFile → storage → parsing queue
  → ParsingProcessor → (chunking) → ChunkingProcessor → EmbeddingsProcessor
```

| Step | File | Log |
|------|------|-----|
| API entry | documents.controller.ts | `[UploadFile] Entry` (workspaceId, documentId, fileName, mimeType, sizeBytes, parser) |
| Storage upload | documents.service.ts | `[UploadFile] File stored` (fileId, storageKey, documentId) |
| Job enqueue | documents.service.ts | `[UploadFile] Adding job to queue`, `Parsing job added to queue` |
| Parsing start | parsing.processor.ts | `Starting parsing job`, `[Parsing] Branch: chunking` or `skip` |
| Chunking | chunking.processor.ts | `[PROGRESS]`, `Job completed successfully` |
| Embeddings | embeddings.processor.ts | `[Embeddings] Start`, `[Embeddings] Job completed` |
| File available | documents.service.ts | `[MarkFileAvailable]` |

### 2. Chat / RAG Flow

```
ChatController → RagService → embeddings → vector search → LLM → cache
```

| Step | File | Log |
|------|------|-----|
| Chat request | chat.controller.ts | `[Chat] Request` (documentId, workspaceId, threadId, questionLength, language) |
| RAG start | rag.service.ts | `[RAG] generateAnswer start` |
| Cache hit | rag.service.ts | `[RAG] Cache hit` |
| Vector search | rag.service.ts | `[RAG] Vector search results` (documentChunksCount, legalChunksCount) |
| Execute payload | rag.service.ts | `[RAG] Execute payload consumed` or `expired or invalid` |
| Prepare cache | chat-prepare-cache.service.ts | `[ChatPrepare] Payload stored` |
| Vector store | pgvector-store.service.ts | `[VectorSearch]` (resultCount, queryTimeMs) — debug level |

### 3. Redline Flow

```
RedlineController.generateRedline → RedlineService → VersionService
RedlineController.applyRedline → DiffService → VersionService
```

| Step | File | Log |
|------|------|-----|
| Generate request | redline.controller.ts | `[GenerateRedline] Request` |
| Generation start | redline.service.ts | `[Redline] Generation start` |
| Version created | version.service.ts | `[Version] Created` |
| Apply request | redline.controller.ts | `[ApplyRedline] Request` |

### 4. Document Deletion

| Step | File | Log |
|------|------|-----|
| Start | document-deletion.orchestrator.ts | `[DeleteDocument] Start` |
| Steps | document-deletion.orchestrator.ts | `Step 0: RAG cache invalidated`, `Step 1: Chunks deleted`, etc. |
| Complete | document-deletion.orchestrator.ts | `[DeleteDocument] Completed` |

### 5. Auth & Workspace

| Step | File | Log |
|------|------|-----|
| Workspace access | workspace.guard.ts | `[WorkspaceGuard] Access granted` (workspaceId, userId, role) — debug level |

## Log Levels Used

- **log**: Main flow steps (entry points, completion)
- **debug**: Verbose (vector search timing, workspace guard, deletion steps)
- **warn**: Fallbacks (pg_trgm fallback, stuck jobs)
- **error**: Failures (storage delete, queue add, LLM errors)

## Privacy Rule

**Never log**: document content, chunks, user questions, or chat messages. Only metadata: ids, counts, sizes, status, durations.
