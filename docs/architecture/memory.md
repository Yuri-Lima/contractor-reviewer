# Memory Architecture

Reference for the conversation memory system used by the RAG chat pipeline. Memory stores summaries of prior Q&A exchanges per thread (and optionally per document) to improve multi-turn coherence.

## Overview

| Scope | Description |
|-------|-------------|
| **Thread** | One memory per chat thread. Updated after each persisted message via `SummarizeMemory` job. |
| **Document** | Optional. Rolling summary across threads for a document. (Future) |
| **Workspace** | Optional. Workspace-level context. (Future) |

## Components

| Component | Location | Role |
|-----------|----------|------|
| Memory entity | `apps/api/src/entities/memory.entity.ts` | `scopeType`, `scopeId`, `workspaceId`, `content`, `version` |
| MemoryService | `apps/api/src/memory/memory.service.ts` | `upsert`, `getByScope`, `getDocumentAndThreadMemory`, `listByWorkspace`, `deleteByScope`, `deleteByDocument` |
| SummarizeMemoryProcessor | `apps/api/src/workers/summarize-memory.processor.ts` | BullMQ job: load thread messages → LLM summarize → upsert thread memory |
| Memory queue | `apps/api/src/queue/queue.module.ts` | BullMQ queue `memory` |
| RAG injection | `apps/api/src/rag/rag.service.ts` | `MemoryService.getDocumentAndThreadMemory()` prepended to context before LLM call |

## Flow

1. **Chat message saved** → `ChatController` enqueues `SummarizeMemory` job (when message is persisted; skipped if no-logs).
2. **SummarizeMemory job** → Loads all messages for the thread, calls LLM to produce a 2–4 bullet summary, upserts thread memory.
3. **Next RAG request** → `RagService` fetches document + thread memory via `getDocumentAndThreadMemory(documentId, threadId)`, prepends to context, then runs full RAG pipeline.

## Database

- **Table**: `memories`
- **Migration**: `1782000000000-AddMemories.ts`
- **Unique index**: `(scopeType, scopeId)` — one memory per scope
- **Index**: `workspaceId` — for purge and DSAR export

## Document Deletion

When a document is hard-deleted via `DELETE /workspaces/:workspaceId/documents/:documentId`, `DocumentDeletionOrchestrator` calls `MemoryService.deleteByDocument(documentId)` to remove document-scoped memories. The `Memory` entity has no FK to `Document` (polymorphic scope), so DB cascade does not delete them; the orchestrator handles this explicitly. Thread-scoped memories are removed when chat threads are cascade-deleted with the document.

## Purge

`PurgeService.purgeExpiredMemory()` runs after chat purge in the daily full purge job. It removes:

1. **Orphaned memories** — Thread or document no longer exists
2. **Retention-based** — Memory older than text/embeddings retention (same as chat)

## DSAR Export

Memories are included in the privacy export JSON (`PrivacyExportData.memories`). Each entry has `id`, `scopeType`, `scopeId`, `content`, `version`, `updatedAt`.

## Thread Export

Users can export a conversation as markdown via `GET /workspaces/:workspaceId/documents/:documentId/chat/threads/:threadId/export`. The response is a `.md` file with User/Assistant sections.

## Configuration

- **No-logs**: When `skipChatMessages` is enabled, chat messages are not persisted, so `SummarizeMemory` is not enqueued. No new memory is created.
- **Worker**: The BullMQ worker process must be running for `SummarizeMemoryProcessor` to process jobs.
