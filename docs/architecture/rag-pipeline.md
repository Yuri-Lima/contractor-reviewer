# RAG Pipeline Reference

Canonical reference for the ContractAI Review RAG pipeline. Use this document to understand file locations, data flow, types, and configuration.

## File Map

| Component | File | Role |
|-----------|------|------|
| Main RAG flow | `apps/api/src/rag/rag.service.ts` | `generateAnswerStream()`: embed question, search chunks, inject memory, build context, stream LLM completion (SSE) |
| Document retrieval | Same file | `searchDocumentChunks()` — pgvector cosine similarity |
| Legal retrieval | Same file | `searchLegalChunks()` — pgvector + jurisdiction filter |
| Jurisdiction resolution | `apps/api/src/rag/jurisdiction-resolver.service.ts`, `jurisdiction-evaluation.service.ts` | Evidence extraction, LLM evaluation, candidates for user override; see [jurisdiction-resolution.md](./jurisdiction-resolution.md) |
| Memory injection | Same file | `MemoryService.getDocumentAndThreadMemory()` — document/thread summaries prepended to context |
| Embeddings | `apps/api/src/rag/embeddings.service.ts` | OpenAI `text-embedding-3-small` |
| Chunking | `apps/api/src/rag/chunking.service.ts` | Paragraph/sentence/fixed-size strategies |
| Prompts | `apps/api/src/prompts/prompt.service.ts` | DB-backed prompts, workspace overrides |
| Prompt Generator | `apps/api/src/prompts/prompt-generator.service.ts` | LLM-assisted generation of document/workspace prompts from title+description; see [prompt-generator.md](./prompt-generator.md) |
| Vector store | `apps/api/src/vector-store/` | `IVectorStore` interface, pgvector implementation |
| Ingestion | `apps/api/src/workers/parsing.processor.ts`, `chunking.processor.ts`, `embeddings.processor.ts` | Parsing → Chunking → Embeddings |
| Memory summarization | `apps/api/src/workers/summarize-memory.processor.ts` | BullMQ job: summarize thread Q&A → upsert thread memory |
| Memory | `apps/api/src/memory/memory.service.ts` | Thread/document memory for RAG context injection |
| Memory entity | `apps/api/src/entities/memory.entity.ts` | `scopeType` (thread/document/workspace), `scopeId`, `content`, `version` |
| Web search | `apps/api/src/web-search/web-search.service.ts` | Tavily-backed web search for supplementing RAG with web sources (jurisdiction-aware) |
| Parsers | `apps/api/src/parsers/` | Docling, PDFPlumber, DPT-2 adapters |

## Data Flow

### Ingestion Flow

```mermaid
flowchart LR
    Upload[Upload File] --> Validate[Storage Validate]
    Validate --> BullMQ[BullMQ Job]
    BullMQ --> Parsing[Parsing Processor]
    Parsing --> Chunking[Chunking Processor]
    Chunking --> Embeddings[Embeddings Processor]
    Embeddings --> Available[Document Available]
```

Parsing uses parser adapters (Docling default, PDFPlumber, DPT-2). Docling and PDFPlumber are Python microservices in `services/docling/` and `services/pdfplumber/`.

### Chat Flow

```mermaid
flowchart TD
    Question[User Question] --> ForceFresh{forceFresh?}
    ForceFresh -->|yes| FullRAG[Full RAG Pipeline]
    ForceFresh -->|no| Embed[EmbeddingsService.generateEmbedding]
    Embed --> CheckCache[Check Semantic Cache]
    CheckCache --> Similarity{Similarity >= threshold?}
    Similarity -->|yes| ReturnCached[Return Cached + fromCache: true]
    Similarity -->|no| FullRAG
    FullRAG --> SearchDocument[vectorStore.searchDocumentChunks]
    SearchDocument --> SearchLegal[vectorStore.searchLegalChunks]
    SearchLegal --> InjectMemory[Inject document/thread memory]
    InjectMemory --> BuildContext[Build context with citations]
    BuildContext --> PromptService[PromptService.getPrompt]
    PromptService --> OpenAI[OpenAI chat]
    OpenAI --> StoreCache[Store in Cache]
    StoreCache --> ReturnFresh[Return + fromCache: false]
```

Flow: `ChatController.chatStream()` (`POST /chat/stream`, SSE) → `RagService.generateAnswerStream()` → semantic cache lookup (or bypass if `forceFresh`) → `EmbeddingsService` + `IVectorStore` + `MemoryService.getDocumentAndThreadMemory()` + optional `WebSearchService.search()` + `PromptService` → LLM provider streaming completion → cache store on miss. The controller persists the assembled answer (carrying `fromCache`) and enqueues a `SummarizeMemory` job after the `done` event (unless no-logs skips persistence or the client aborted mid-stream). The non-stream `POST /chat` endpoint and `RagService.generateAnswer()` / `generateAnswerText()` were removed; streaming is the single chat path.

**Status phases**: During the preparation phase, the SSE stream emits `status` events (`StreamStatusChunk`) so the UI shows real-time progress instead of a blank spinner. Phases: `embedding` → `searching` → `web-search` (when enabled) → `generating`. Embedding, settings retrieval, and preflight checks run concurrently to reduce latency. Message persistence and audit logging run in the background after the stream completes.

### Semantic Query Cache

Before running the full RAG pipeline, the system checks a Redis-based semantic query cache:

- **Cache keys**: `rag:cache:data:{key}`, `rag:cache:index:{documentId}:{jurisdiction}:{language}`, `rag:doc:{documentId}:keys`
- **Lookup**: Generate query embedding → compare cosine similarity with cached embeddings → if `max(similarity) >= threshold`, return cached response with `fromCache: true`
- **Threshold**: Configurable per user (Account Settings > Chat) or server default (`RAG_CACHE_SIMILARITY_THRESHOLD`, default 0.95)
- **Invalidation**: On document delete, when embeddings job completes (reprocessing), and when jurisdiction is overridden or re-evaluated
- **TTL**: 24h default (`RAG_CACHE_TTL_SECONDS`)
- **Client**: `forceFresh: true` bypasses cache; responses include `fromCache` flag

See [rag-cache.md](./rag-cache.md) for full architecture.

### Dev Mode: Prepare/Execute Flow

When Developer Mode is enabled (Settings) and `CHAT_PREPARE_ENABLED=true`, the chat uses a two-phase flow:

1. `POST /chat/prepare` – Embed question, search chunks, build prompts; return payload + `requestId` (no LLM call).
2. User reviews payload in a dialog (tabs: Question, System Prompt, User Prompt, Contract Chunks, Legal Chunks, Model Params).
3. `POST /chat/execute` – With `requestId`, call LLM and return response.

See [chat-prepare-dev-mode.md](./chat-prepare-dev-mode.md) for full reference.

## Key Types

### ChatResponse (from `@contractai-review/shared`)

```typescript
interface ChatResponse {
  answerText: string;
  confidence: 'high' | 'medium' | 'low';
  citations: Citation[];
  notFound: boolean;
  fromCache?: boolean;  // true when response came from semantic cache
}
```

### Citation (from `@contractai-review/shared`)

```typescript
// Wire/API shape — superset of all citation fields
interface Citation {
  type: 'document' | 'legal' | 'contract'; // 'contract' is deprecated
  fileName?: string;
  pageNumber?: number;
  paragraph?: string;
  paragraphId?: string;
  quoteSnippet?: string;
  sourceName?: string;
  section?: string;
  url?: string;
}

// Narrow shapes used when building citations in `RagService` (with `satisfies`)
interface DocumentCitation {
  type: 'document' | 'contract';
  fileName?: string;
  pageNumber?: number;
  paragraph?: string;
  paragraphId?: string;
  quoteSnippet?: string;
}

interface LegalSourceCitation {
  type: 'legal';
  sourceName?: string;
  section?: string;
  url?: string;
  quoteSnippet?: string;
}
```

**Notes:**
- `'contract'` is deprecated. Use `'document'` for citations from the user's uploaded document. The union still accepts `'contract'` for backward compatibility with cached/legacy responses. Use `isDocumentCitation(c)` to treat both as document citations.
- New code in `RagService` builds citations with `satisfies DocumentCitation` / `satisfies LegalSourceCitation` so `type` and the relevant fields stay aligned at compile time.

### VectorStore (from `apps/api/src/vector-store/vector-store.interface.ts`)

```typescript
interface IVectorStore {
  searchDocumentChunks(queryEmbedding: number[], documentId: string, limit?: number): Promise<VectorSearchResult<Chunk>[]>;
  searchLegalChunks(queryEmbedding: number[], filters?: LegalChunkFilters, limit?: number): Promise<LegalChunkSearchResult[]>;
}

interface VectorSearchResult<T> {
  item: T;
  distance: number; // similarity (1 - cosine_distance)
}

interface LegalChunkSearchResult extends VectorSearchResult<Embedding> {
  sourceName?: string;
  section?: string;
  country?: string;
  jurisdiction?: string;
  url?: string;
}
```

## Configuration

### Environment Variables

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | Required for embeddings (`text-embedding-3-small`) and the OpenAI chat adapter |
| `OPENAI_CHAT_MODEL` | OpenAI chat model (default: `gpt-4o-mini`) |
| `ANTHROPIC_API_KEY` | Required when a workspace selects the Anthropic LLM provider |
| `ANTHROPIC_CHAT_MODEL` | Anthropic chat model (default: `claude-sonnet-4-20250514`) |
| `LLM_MAX_TOKENS` | Max output tokens per LLM completion. Default: `2000`. Higher values allow longer answers but increase cost. |
| `DOCLING_URL` | Docling service URL (default: `http://localhost:8000`) |
| `PDFPLUMBER_URL` | PDFPlumber service URL (default: `http://localhost:8001`) |
| `XAI_API_KEY` | Required when a workspace selects the xAI (Grok) LLM provider |
| `XAI_CHAT_MODEL` | xAI chat model (default: `grok-4-1-fast-reasoning`) |
| `LOG_LLM_PROMPT_CONTEXT` | When `true`, logs the full system + user prompt sent to the LLM (debug only — never enable in production). |

### LLM Provider Selection

LLM completions are abstracted by `LlmProviderRegistry` (`apps/api/src/llm/`). Three adapters are bundled:

| Provider | Adapter | ID | Structured Output |
|----------|---------|----|-------------------|
| OpenAI (default) | `OpenAILlmAdapter` | `openai` | `json_schema` response format |
| Anthropic | `AnthropicLlmAdapter` | `anthropic` | Single-tool `tool_choice` |
| xAI (Grok) | `XaiLlmAdapter` | `xai` | `json_schema` response format (OpenAI-compatible API) |

Per-workspace override: `WorkspaceSettings.documentProcessing.defaultLlmProvider` (`openai` \| `anthropic` \| `xai`). When unset, the registry falls back to OpenAI. All adapters honor `LLM_MAX_TOKENS` and implement `completeStream()` for SSE chat and `completeStructured()` for structured-output calls (legal-grade pipeline). xAI uses an OpenAI-compatible endpoint at `https://api.x.ai/v1`; embeddings continue to use OpenAI regardless of the selected chat provider.

### RAG Retrieval Tuning

| Variable | Default | Description |
|----------|---------|-------------|
| `RAG_TOP_K_DOCUMENT` | `8` | Number of top-similarity document chunks fetched per question. Range: 1..50. Higher = better recall on long contracts, more tokens per request. |
| `RAG_TOP_K_LEGAL` | `3` | Number of top-similarity legal chunks fetched per question (when jurisdiction set). Range: 1..20. |
| `RAG_SIMILARITY_FLOOR` | `0.5` | Minimum cosine similarity for a chunk to reach the LLM. Set to 0 to disable filtering. |
| `RAG_SIMILARITY_FLOOR_FALLBACK` | `0.3` | Relaxed floor used when the strict floor yields zero chunks. Set equal to `RAG_SIMILARITY_FLOOR` to disable relaxation. |
| `RAG_CITATION_CAP_DOCUMENT` | `5` | Maximum document citations returned to the UI. Range: 1..20. |
| `RAG_CITATION_CAP_LEGAL` | `2` | Maximum legal citations returned to the UI. Range: 1..20. |

Parsed at startup via `parseEnvInt` / `parseEnvFloat` utility functions with bounds checking. Logged at `[RAGConfig]` prefix.

### Web Search (Tavily)

When enabled, the RAG pipeline conditionally supplements vector-retrieved chunks with web search results for legal questions. Uses the Tavily Search API (free tier).

| Variable | Default | Description |
|----------|---------|-------------|
| `WEB_SEARCH_ENABLED` | `off` | Set to `on`, `true`, or `1` to enable web search in the RAG pipeline. |
| `TAVILY_API_KEY` | — | Tavily API key (required when web search is enabled). |
| `WEB_SEARCH_MONTHLY_BUDGET` | `900` | Maximum Tavily API calls per calendar month (in-memory counter; resets on process restart). |
| `WEB_SEARCH_MAX_RESULTS` | `5` | Max results per query (capped at Tavily free-tier limit of 5). |

`WebSearchService` features: jurisdiction-aware query enrichment (ISO codes expanded to English names), statute hint forwarding (act names from RAG context), 600ms rate limiting (100 RPM), monthly budget tracking, graceful degradation (returns `[]` on any failure — never blocks the RAG pipeline). Web sources appear as `webSources` in the prompt and citation output.

### Workspace Settings (via Workspace Settings UI or API)

| Setting | Keys | Description |
|---------|------|-------------|
| `chunkingStrategy` | `paragraph`, `sentence`, `fixed_size` | How text is split for RAG |
| `defaultDocumentParser` | `docling`, `pdfplumber`, `dpt2`, `llamaparse`, `unstructured` | Parser used when none selected at upload |
| `parserApiKeys` | Per-parser encrypted keys | For DPT-2, LlamaParse, Unstructured |
| Global prompt | `global.system` | Account-level system prompt (Account Settings → AI Prompts) |
| Workspace prompt | `workspace.system` | Workspace-level system prompt (Workspace Settings → AI Prompts) |
| Document prompts | chat keys | Document-level prompts (Document Settings) |

### Prompt Keys (from `packages/shared/src/constants/prompts.ts`)

**Scoped by level:**
- **Account (1 prompt):** `global.system` — Global system prompt, merged at top of context (Account Settings → AI Prompts)
- **Workspace (1 prompt):** `workspace.system` — Workspace system prompt, merged below global (Workspace Settings → AI Prompts)
- **Document (2 prompts):** `chat.system`, `chat.user` — Chat RAG (Document Settings only)

**Prompt hierarchy:** For system key (`chat.system`): `global.system` + `workspace.system` + document override (per scope toggles). See [prompt-generator.md](prompt-generator.md) for prompt categories and create-document API.

## Memory (Conversation Summaries)

The system maintains **memory** per thread and optionally per document. Memory is used to inject prior conversation context into RAG prompts for multi-turn coherence.

| Component | File | Role |
|-----------|------|------|
| Memory entity | `apps/api/src/entities/memory.entity.ts` | `scopeType` (thread/document/workspace), `scopeId`, `content`, `version` |
| MemoryService | `apps/api/src/memory/memory.service.ts` | `upsert`, `getByScope`, `getDocumentAndThreadMemory`, `listByWorkspace` |
| SummarizeMemory job | `apps/api/src/workers/summarize-memory.processor.ts` | After each chat message (when persisted), LLM summarizes thread Q&A → upsert thread memory |
| Memory queue | `apps/api/src/queue/queue.module.ts` | BullMQ queue `memory` |
| Purge | `apps/api/src/retention/purge.service.ts` | `purgeExpiredMemory()` — orphaned memories + retention-based; runs after chat purge |
| DSAR export | `apps/api/src/privacy/privacy.service.ts` | Memories included in privacy export JSON |

Memory is injected into the RAG context before the LLM call. Thread memory is updated asynchronously via the `memory` queue.

## Current State Summary

| Area | Status |
|------|--------|
| RAG pipeline | `RagService` + workers — centralized, works |
| Memory | Thread/document summaries; SummarizeMemory job; RAG injection; DSAR export; purge |
| Prompts | `PromptService` — DB-backed, workspace overrides |
| Docling | **Default parser** — DoclingAdapter, `services/docling/` |
| DOCX | Supported — Docling, PDFPlumber, DPT-2 |
| Chunking | Paragraph/sentence/fixed-size configurable |
| Vector search | pgvector cosine similarity |

## Legal-grade Pipeline (Phase 1–4)

When `LEGAL_REVIEW_MODE=on` (default), the chat answer path swaps the
free-form prose template for a structured `LegalAnswer` and a persistent
drafting reviewer is attached to the document lifecycle.

### Pipeline shape

1. **Structured chat answer (Phase 1)** — `RagService.generateAnswerStream`
   selects the `legal-review-v2` prompt variant, calls
   `ILlmProvider.completeStructured` (OpenAI/xAI `json_schema`, Anthropic
   single-tool `tool_choice`), and validates against `LegalAnswerZ`. A
   single corrective retry is attempted with the first 3 Zod errors and a
   1500-char excerpt of the rejected payload before falling back to a
   degraded prose answer.
2. **Clause-aware retrieval (Phase 2)** — `Chunk.clauseNumber` and
   `Chunk.headingPath` are extracted by `ChunkingService.splitMarkdownBlocksWithHeadings`
   from docling's heading-preserving markdown; `RagService.formatDocumentContext`
   emits `[Clause X.Y.Z]` labels and propagates `Citation.clauseNumber`. An
   admin `POST /workspaces/:wsId/documents/:docId/reindex` endpoint
   re-chunks an existing document without re-parsing.
3. **Jurisdictional legal corpus (Phase 3)** — Curated YAMLs under
   `services/legal-corpus/<JURIS>/` are loaded by
   `apps/api/src/scripts/seed-legal-corpus.ts` into `LegalSource` +
   `Embedding` rows with denormalised `actName`, `actYear`, and
   `lastVerified` columns. `RagService.rerankLegalByActMention` adds a
   +0.1 similarity bonus when a candidate `actName` is mentioned in the
   matching document chunks.
4. **Persistent drafting review (Phase 4)** — On post-jurisdiction
   completion, `JurisdictionEvaluationProcessor` enqueues a
   `document-review` job. `DocumentReviewProcessor` runs
   `DocumentReviewService.runReview`, which combines `RuleDetectorService`
   (regex YAML rules versioned in `services/red-flag-rules/<version>/`)
   with `LlmDetectorService` (16k-char windows, structured output) and
   merges them via `MergeService` (key: `(category, clauseRef)`,
   tie-breaker: Levenshtein ≥ 0.85). One row per
   `(documentId, rulesVersion, llmModel)` is persisted to
   `document_reviews`; the UI surfaces it in the **Review** tab.

### Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `LEGAL_REVIEW_MODE` | `on` | Master switch for the legal-grade chat answer path AND the LLM detector inside `DocumentReviewService`. Set to `off` for rules-only review. |
| `LEGAL_REVIEW_AUTO_REVIEW` | `on` | When `off`, post-jurisdiction does NOT auto-enqueue `document-review`; reviews must be triggered via `POST .../review/rerun`. |
| `LEGAL_REVIEW_MODEL_<PROVIDER>` | unset | Per-provider override of the model used for high-stakes structured calls (e.g. `LEGAL_REVIEW_MODEL_OPENAI=gpt-4o`, `LEGAL_REVIEW_MODEL_ANTHROPIC=claude-opus-4-7`). Falls back to the adapter's `defaultModel`. |
| `LEGAL_CORPUS_AUTO_SEED` | `off` | When `on`, the seed script may be run as part of API startup. By default, ops run `pnpm tsx apps/api/src/scripts/seed-legal-corpus.ts` manually. |
| `RED_FLAG_RULES_VERSION` | `v1` | Selects which YAML version under `services/red-flag-rules/` is loaded by `RuleLoaderService`. Bump to invalidate persisted reviews and force regeneration. |

### Cost envelope (back-of-envelope)

A typical 6-page contract under default settings:

- 1 `completeStructured` chat call per question — gpt-4o-mini-class
  prompt of ~2k tokens in / 1k tokens out → **~$0.001**.
- 1 `document-review` run on first OCR completion — 1–2 LLM windows
  × 4k tokens in / 1k tokens out under gpt-4o → **~$0.02**.
- Subsequent question pages re-use the persisted review at no LLM
  cost; rerun only on user request or rules version bump.

Set `LEGAL_REVIEW_MODE=off` and `LEGAL_REVIEW_AUTO_REVIEW=off` to fall
back to the prose answer path and rules-only reviews when running
budget-constrained workspaces.

## Future Work

Recommendations for improvements:

1. **Policy answer** — Fallback chain: VectorDB error → keyword search; LLM error → formatted chunks; Embedding error → text search
2. **Cache** — ✅ Implemented: Semantic query cache in Redis; embedding similarity (threshold 0.95); TTL 24h; invalidate on document reprocess/delete; `fromCache` and `forceFresh` support
3. **Hybrid recall** — Add keyword search (tsvector/pg_trgm); fuse with semantic via RRF or weighted score
4. **Monitoring** — Metrics for embedding latency, retrieval similarity, chunk count
5. **Local LLM** — Abstract `LLMProvider`; support vLLM, Llama.cpp via config

See the original gap analysis (archived) for detailed recommendations.

## Inference Providers to Evaluate

Alternative AI inference/GPU infrastructure providers to analyse for cost, latency, and scaling trade-offs against the current OpenAI/Anthropic direct-API setup:

| Provider | Focus | URL | Status |
|----------|-------|-----|--------|
| **Fireworks AI** | Optimised open-model inference (serverless + on-demand); supports DeepSeek, Qwen, Gemma, Llama, Whisper, FLUX; fine-tuning; sub-second latency | <https://fireworks.ai/> | 🔍 To evaluate |
| **RunPod** | GPU cloud (pods, serverless, clusters); 30+ GPU SKUs across 31 regions; autoscaling with FlashBoot (<200ms cold-start); SOC 2 Type II | <https://www.runpod.io/> | 🔍 To evaluate |

**Evaluation criteria (TODO):**
- Price per million tokens (input/output) vs current OpenAI/Anthropic costs
- P50/P95 latency for structured-output calls (`completeStructured`)
- Model availability (gpt-4o-class, Claude-class, open models)
- Streaming support compatibility with existing `ILlmProvider.completeStream`
- Fine-tuning capability for domain-specific legal review
- Data residency / GDPR compliance for EU workspaces
- Self-hosted / BYOC options for on-prem deployments
