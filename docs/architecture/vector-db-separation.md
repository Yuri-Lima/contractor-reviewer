# Vector DB Separation Architecture

This document describes the architecture for future migration from a single PostgreSQL+pgvector database to a separated setup: one relational DB and one vector DB.

## Overview

- **Relational DB**: Auth, workspaces, documents, billing, audit, etc.
- **Vector DB**: Chunks (document embeddings) and embeddings (legal source embeddings)

## Design Principles

1. **Centralized vector access**: All chunk CRUD and vector search go through `IChunkRepository` and `IVectorStore`
2. **ID-based flow**: Vector search returns IDs/chunk rows; document metadata is fetched from relational by ID
3. **No cross-DB JOINs**: Legal embeddings have denormalized metadata (sourceName, country, jurisdiction, url)
4. **Orchestrated deletes**: `DocumentDeletionOrchestrator` enforces order: RAG cache invalidation → chunks → memories → storage → document

## Entity Boundaries

| Group | Entities | Database |
|-------|----------|----------|
| Relational | User, Workspace, WorkspaceMember, Document, DocumentFile, DocumentJob, ChatMessage, AuditLog, WorkspaceSettings, LegalSource, UserOnboarding, UserStorageSettings, Prompt, ImageAsset | Relational |
| Vector | Chunk, Embedding | Vector (pgvector) |

These boundaries are maintained by convention in the codebase (the previously standalone `entity-boundaries.ts` constants file was removed during cleanup).

## Key Components

### ChunkRepository (`IChunkRepository`)

- `create(data)` - create chunks (used by ChunkingProcessor)
- `findByDocumentId(documentId)` - get chunks for versioning / getOriginalText
- `deleteByDocumentId(documentId)` - delete chunks when document is removed or purged
- `findByIds(ids)` / `save(chunks)` - used by EmbeddingsProcessor

All chunk access is funneled through this abstraction. When separating DBs, swap the implementation to use the vector DataSource.

### VectorStore (`IVectorStore`)

- `searchDocumentChunks` - similarity search within a document (returns Chunk rows)
- `searchLegalChunks` - similarity search with filters (returns Embedding rows + denormalized metadata)

Legal search uses denormalized columns on `embeddings` table (no JOIN with `legal_sources`).

### DocumentDeletionOrchestrator

Centralizes document deletion order:

1. Invalidate RAG cache for the document
2. Delete chunks (vector DB when separated)
3. Delete document-scoped memories (no FK cascade; `MemoryService.deleteByDocument`)
4. Delete files from storage
5. Delete document (relational - cascade removes files, jobs, chat threads, versions, etc.)

## Configuration

- `DATABASE_URL` - relational connection
- `VECTOR_DATABASE_URL` (optional) - vector connection; when unset, uses `DATABASE_URL`

Database connection configuration is resolved via NestJS `ConfigModule` and the TypeORM module configuration in `app.module.ts` (the previously standalone `database.config.ts` helper was removed during cleanup).

## Migration Checklist (When Separating)

1. Create second Postgres (+ pgvector) instance
2. Run migrations for `chunks` and `embeddings` on vector DB
3. Add `VECTOR_DATABASE_URL`, create second TypeORM DataSource
4. Point `ChunkRepository` and `PgVectorStore` to vector DataSource
5. `DocumentDeletionOrchestrator` already handles cross-DB deletes
6. Purge: get expired doc IDs from relational; delete chunks by documentId from vector DB
7. pg_dump/pg_restore chunks and embeddings to new DB; switch connection

## Legal Source Embeddings

When creating new embeddings for legal sources, populate denormalized columns from `legal_sources`: `sourceName`, `country`, `jurisdiction`, `url`. If legal sources are updated, re-run embedding backfill to refresh denormalized columns.
