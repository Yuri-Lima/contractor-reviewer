# Semantic RAG Query Cache

Reference doc for the Redis-based semantic query cache used by the RAG chat pipeline.

## Purpose

- Reduce latency and token usage for repeated or semantically similar questions
- Signal to users when a response is from cache via `fromCache`
- Allow clients to force fresh responses via `forceFresh: true`

## Architecture

### Redis Storage

Uses the same Redis instance as BullMQ (shared `REDIS_CLIENT`). Cache keys use explicit prefix `rag:cache:` to avoid collisions.

| Key Pattern | Purpose |
|-------------|---------|
| `rag:cache:data:{cacheKey}` | JSON of `ChatResponse`, TTL (e.g. 24h) |
| `rag:cache:index:{documentId}:{jurisdiction}:{language}` | Redis List of entries: `{embedding, key, createdAt}` for semantic lookup |
| `rag:doc:{documentId}:keys` | Set of cacheKey strings for invalidation |
| `rag:doc:{documentId}:indexes` | Set of index key names for atomic invalidation |

### Lookup Flow

1. Generate query embedding (same model as ingestion)
2. `LRANGE` index for `(documentId, jurisdiction, language)`
3. Compute cosine similarity between query embedding and each stored embedding
4. If `max(similarity) >= similarityThreshold`, return cached response from `rag:cache:data:{matchedKey}`
5. Otherwise → full RAG pipeline

### Store Flow (atomic MULTI/EXEC)

1. Generate `cacheKey` (UUID)
2. Pipeline: `SET rag:cache:data:{key} value EX ttl`, `LPUSH` + `LTRIM` index, `SADD` doc keys/indexes
3. Single `SET ... EX ttl` for atomic set+expire

### Invalidation

| Trigger | Action |
|---------|--------|
| Document delete | `RagCacheService.invalidateDocument(documentId)` — delete all `rag:cache:*` and `rag:doc:*` keys for that document |
| Embeddings job complete | Same `invalidateDocument(documentId)` — reprocessed chunks may change context |

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `RAG_CACHE_ENABLED` | `true` | Enable/disable cache |
| `RAG_CACHE_TTL_SECONDS` | `86400` (24h) | TTL for cached responses |
| `RAG_CACHE_SIMILARITY_THRESHOLD` | `0.95` | Server default when user has no preference |
| `RAG_CACHE_MAX_ENTRIES_PER_DOCUMENT` | `50` | Max entries per document index (memory ~12KB × N per doc) |

### User Preference

Account Settings > Chat tab: users can set `ragCacheSimilarityThreshold` (0.80–1.0). `null` = use server default.

- Lower: more cache hits (faster, may be less precise)
- Higher: stricter match (fewer cache hits)

## Redis Production Notes

- **Shared Redis**: BullMQ requires `maxmemory-policy=noeviction` for queue reliability. Cache keys have TTL and expire; when memory is full, Redis rejects writes — RagCacheService handles errors gracefully (RAG works without cache).
- **Best-effort**: Cache is best-effort; RAG functions correctly when Redis is unavailable.
- **No plaintext logging**: Never log contract content, chunks, or user questions. Cache hit/miss counts are acceptable for observability.

## API Flags

| Flag | Location | Description |
|------|----------|-------------|
| `forceFresh` | `ChatRequest` | Bypass cache for this request |
| `fromCache` | `ChatResponse` | `true` when response came from cache |
