import { Logger } from '@nestjs/common';
import { RagService } from './rag.service';
import type { Chunk } from '../entities/chunk.entity';
import type {
  IVectorStore,
  LegalChunkSearchResult,
  VectorSearchResult,
} from '../vector-store/vector-store.interface';

type EnvOverrides = Record<string, string | undefined>;

interface MockBag {
  vectorStore: jest.Mocked<IVectorStore>;
  documentRepository: { findOne: jest.Mock };
  embeddingsService: { generateEmbedding: jest.Mock; modelName: string };
  promptService: {
    getChatPrompts: jest.Mock;
    getLanguageName: jest.Mock;
  };
  workspaceSettingsService: { getSettings: jest.Mock };
  configService: { get: jest.Mock };
  ragCacheService: { get: jest.Mock; set: jest.Mock };
  chatPrepareCacheService: { set: jest.Mock; getAndDelete: jest.Mock };
  llmProviderRegistry: {
    resolveProvider: jest.Mock;
    resolveFromSettings: jest.Mock;
  };
  memoryService: { getDocumentAndThreadMemory: jest.Mock };
  legalReviewModelResolver: { resolve: jest.Mock };
  webSearchService: { isEnabled: jest.Mock; search: jest.Mock };
}

function makeChunk(
  distance: number,
  idx = 0,
  extra: Partial<Chunk> = {},
): VectorSearchResult<Chunk> {
  return {
    item: {
      id: `chunk-${idx}`,
      text: `chunk text ${idx}`,
      pageNumber: idx + 1,
      paragraphId: `p-${idx}`,
      ...extra,
    } as unknown as Chunk,
    distance,
  };
}

function makeLegalChunk(distance: number, idx = 0): LegalChunkSearchResult {
  return {
    item: {
      id: `legal-${idx}`,
      text: `legal text ${idx}`,
      section: `s-${idx}`,
    } as unknown as LegalChunkSearchResult['item'],
    distance,
    sourceName: `Source ${idx}`,
    section: `s-${idx}`,
    url: `https://example.com/${idx}`,
  };
}

/**
 * Construct a RagService with hand-rolled mocks for all 10 deps.
 * `envOverrides` controls what ConfigService.get() returns.
 *
 * Returns both the service and the mock bag so tests can assert call args.
 */
function buildService(
  envOverrides: EnvOverrides = {},
  chunkResults: VectorSearchResult<Chunk>[] = [],
  legalResults: LegalChunkSearchResult[] = [],
): { service: RagService; mocks: MockBag } {
  // Default chunk stats: total === embedded === <chunk count> so the
  // pre-flight diagnostic returns null (no notFoundReason). Tests that
  // care about the no_chunks / embeddings_pending paths override this.
  const vectorStore = {
    searchDocumentChunks: jest.fn().mockResolvedValue(chunkResults),
    searchLegalChunks: jest.fn().mockResolvedValue(legalResults),
    getDocumentChunkStats: jest.fn().mockResolvedValue({
      total: Math.max(chunkResults.length, 1),
      embedded: Math.max(chunkResults.length, 1),
    }),
  } as unknown as jest.Mocked<IVectorStore>;

  const mocks: MockBag = {
    vectorStore,
    documentRepository: {
      findOne: jest.fn().mockResolvedValue({ id: 'doc-1', title: 'Doc 1' }),
    },
    embeddingsService: {
      generateEmbedding: jest.fn().mockResolvedValue([0.1, 0.2, 0.3]),
      modelName: 'text-embedding-3-small',
    },
    promptService: {
      getChatPrompts: jest.fn().mockResolvedValue({
        system: 'system prompt',
        user: 'user prompt',
      }),
      getLanguageName: jest.fn().mockReturnValue('English'),
    },
    workspaceSettingsService: {
      getSettings: jest.fn().mockResolvedValue(null),
    },
    configService: {
      get: jest.fn((key: string) => envOverrides[key]),
    },
    ragCacheService: {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
    },
    chatPrepareCacheService: {
      set: jest.fn().mockResolvedValue('req-123'),
      getAndDelete: jest.fn().mockResolvedValue(null),
    },
    llmProviderRegistry: {
      resolveProvider: jest.fn().mockResolvedValue({
        id: 'mock-provider',
        complete: jest.fn().mockResolvedValue('answer'),
        completeStream: jest
          .fn()
          .mockImplementation(async function* () {
            yield 'answer';
          }),
      }),
      // generateAnswerStream uses the sync path after settings are already loaded
      resolveFromSettings: jest.fn().mockReturnValue({
        id: 'mock-provider',
        complete: jest.fn().mockResolvedValue('answer'),
        completeStream: jest
          .fn()
          .mockImplementation(async function* () {
            yield 'answer';
          }),
      }),
    },
    memoryService: {
      getDocumentAndThreadMemory: jest.fn().mockResolvedValue(null),
    },
    legalReviewModelResolver: {
      resolve: jest.fn().mockReturnValue(undefined),
    },
    webSearchService: {
      isEnabled: jest.fn().mockReturnValue(false),
      search: jest.fn().mockResolvedValue([]),
    },
  };

  const service = new RagService(
    mocks.vectorStore,
    mocks.documentRepository as never,
    mocks.embeddingsService as never,
    mocks.promptService as never,
    mocks.workspaceSettingsService as never,
    mocks.configService as never,
    mocks.ragCacheService as never,
    mocks.chatPrepareCacheService as never,
    mocks.llmProviderRegistry as never,
    mocks.memoryService as never,
    mocks.legalReviewModelResolver as never,
    mocks.webSearchService as never,
  );

  return { service, mocks };
}

async function drainStream<T>(iter: AsyncIterable<T>): Promise<T[]> {
  const events: T[] = [];
  for await (const evt of iter) events.push(evt);
  return events;
}

describe('RagService', () => {
  let warnSpy: jest.SpyInstance;
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    logSpy = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
    logSpy.mockRestore();
  });

  // ---------------------------------------------------------------------------
  // Section A: Config wiring
  // ---------------------------------------------------------------------------
  describe('config wiring', () => {
    it('uses default top_k=8 when env unset', async () => {
      const { service, mocks } = buildService(
        {},
        [makeChunk(0.9, 0)],
      );
      await service.prepareForChat('q', 'doc-1', 'ws-1');
      expect(mocks.vectorStore.searchDocumentChunks).toHaveBeenCalledWith(
        expect.any(Array),
        'doc-1',
        8,
        expect.any(String), // active embedding model filter
      );
    });

    it('propagates RAG_TOP_K_DOCUMENT override to the vector store call', async () => {
      const { service, mocks } = buildService(
        { RAG_TOP_K_DOCUMENT: '12' },
        [makeChunk(0.9, 0)],
      );
      await service.prepareForChat('q', 'doc-1', 'ws-1');
      expect(mocks.vectorStore.searchDocumentChunks).toHaveBeenCalledWith(
        expect.any(Array),
        'doc-1',
        12,
        expect.any(String),
      );
    });

    it('propagates RAG_TOP_K_LEGAL override', async () => {
      const { service, mocks } = buildService(
        { RAG_TOP_K_LEGAL: '7' },
        [],
        [makeLegalChunk(0.9, 0)],
      );
      await service.prepareForChat('q', 'doc-1', 'ws-1', 'BR');
      expect(mocks.vectorStore.searchLegalChunks).toHaveBeenCalledWith(
        expect.any(Array),
        {
          country: undefined,
          jurisdiction: 'BR',
          embeddingModel: expect.any(String),
        },
        7,
      );
    });

    it('floor=0 keeps every chunk (strict-> semantics)', async () => {
      const chunks = [
        makeChunk(0.0, 0), // exactly 0 — strict > 0 drops it
        makeChunk(0.05, 1),
        makeChunk(0.5, 2),
      ];
      const { service } = buildService(
        { RAG_SIMILARITY_FLOOR: '0' },
        chunks,
      );
      const result = await service.prepareForChat('q', 'doc-1', 'ws-1');
      expect(result.payload.documentChunks).toHaveLength(2);
    });

    it('logs resolved tuning at boot', () => {
      buildService();
      const ragLogs = logSpy.mock.calls
        .map((args) => String(args[0]))
        .filter((s) => s.startsWith('[RagConfig]'));
      expect(ragLogs).toHaveLength(1);
      expect(ragLogs[0]).toContain('topKDocument=8');
      expect(ragLogs[0]).toContain('similarityFloor=0.5');
      expect(ragLogs[0]).toContain('citationCapDocument=5');
    });

    it('falls back to default on invalid RAG_TOP_K_DOCUMENT without throwing', async () => {
      const { service, mocks } = buildService(
        { RAG_TOP_K_DOCUMENT: 'not-a-number' },
        [makeChunk(0.9, 0)],
      );
      await service.prepareForChat('q', 'doc-1', 'ws-1');
      expect(mocks.vectorStore.searchDocumentChunks).toHaveBeenCalledWith(
        expect.any(Array),
        'doc-1',
        8,
        expect.any(String),
      );
      expect(warnSpy).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Section B: Empty post-filter behavior
  // ---------------------------------------------------------------------------
  describe('similarity floor filtering', () => {
    it('drops chunks below the floor before they reach the prompt', async () => {
      const chunks = [
        makeChunk(0.9, 0),
        makeChunk(0.6, 1),
        makeChunk(0.4, 2), // below default floor 0.5
        makeChunk(0.2, 3), // below
      ];
      const { service } = buildService({}, chunks);
      const result = await service.prepareForChat('q', 'doc-1', 'ws-1');
      expect(result.payload.documentChunks).toHaveLength(2);
      expect(
        result.payload.documentChunks.every((c) => c.similarity > 0.5),
      ).toBe(true);
    });

    it('returns notFound=true when all chunks filtered out (streaming)', async () => {
      // Below both primary (0.5) and fallback (0.3) floors so the soft-floor
      // fallback cannot rescue them either.
      const chunks = [makeChunk(0.2, 0), makeChunk(0.1, 1)];
      const { service } = buildService({}, chunks);
      const events = await drainStream(
        service.generateAnswerStream('q', 'doc-1', 'ws-1'),
      );
      const done = events.find((e) => 'type' in e && e.type === 'done') as
        | { type: 'done'; notFound: boolean; citations: unknown[]; notFoundReason?: string }
        | undefined;
      expect(done).toBeDefined();
      expect(done!.notFound).toBe(true);
      expect(done!.citations).toEqual([]);
      expect(done!.notFoundReason).toBe('below_floor');
    });

    it('does NOT call ragCacheService.set when notFound=true', async () => {
      const chunks = [makeChunk(0.2, 0)];
      const { service, mocks } = buildService({}, chunks);
      await drainStream(service.generateAnswerStream('q', 'doc-1', 'ws-1'));
      expect(mocks.ragCacheService.set).not.toHaveBeenCalled();
    });

    it('DOES call ragCacheService.set when chunks survive the floor', async () => {
      const chunks = [makeChunk(0.9, 0), makeChunk(0.7, 1)];
      const { service, mocks } = buildService({}, chunks);
      await drainStream(service.generateAnswerStream('q', 'doc-1', 'ws-1'));
      expect(mocks.ragCacheService.set).toHaveBeenCalledTimes(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Section C: Cache stability
  // ---------------------------------------------------------------------------
  describe('cache stability across tuning changes', () => {
    it('cache lookup uses the same key regardless of RAG_TOP_K_DOCUMENT', async () => {
      const chunks = [makeChunk(0.9, 0)];
      const { service: svcA, mocks: mocksA } = buildService(
        { RAG_TOP_K_DOCUMENT: '5' },
        chunks,
      );
      await drainStream(svcA.generateAnswerStream('q', 'doc-1', 'ws-1'));

      const { service: svcB, mocks: mocksB } = buildService(
        { RAG_TOP_K_DOCUMENT: '20' },
        chunks,
      );
      await drainStream(svcB.generateAnswerStream('q', 'doc-1', 'ws-1'));

      const callA = mocksA.ragCacheService.get.mock.calls[0];
      const callB = mocksB.ragCacheService.get.mock.calls[0];
      // documentId, jurisdiction, embedding, language → identical
      expect(callA[0]).toEqual(callB[0]);
      expect(callA[1]).toEqual(callB[1]);
      expect(callA[2]).toEqual(callB[2]);
      expect(callA[3]).toEqual(callB[3]);
    });
  });

  // ---------------------------------------------------------------------------
  // Section D: Citation cap
  // ---------------------------------------------------------------------------
  describe('citation cap', () => {
    it('caps citations at RAG_CITATION_CAP_DOCUMENT', async () => {
      const chunks = Array.from({ length: 8 }, (_, i) => makeChunk(0.9, i));
      const { service } = buildService({}, chunks);
      const events = await drainStream(
        service.generateAnswerStream('q', 'doc-1', 'ws-1'),
      );
      const done = events.find((e) => 'type' in e && e.type === 'done') as
        | { type: 'done'; citations: unknown[] }
        | undefined;
      expect(done!.citations).toHaveLength(5); // default cap
    });

    it('cap is a ceiling: with 2 surviving chunks and cap=5, returns 2', async () => {
      const chunks = [makeChunk(0.9, 0), makeChunk(0.8, 1)];
      const { service } = buildService({}, chunks);
      const events = await drainStream(
        service.generateAnswerStream('q', 'doc-1', 'ws-1'),
      );
      const done = events.find((e) => 'type' in e && e.type === 'done') as
        | { type: 'done'; citations: unknown[] }
        | undefined;
      expect(done!.citations).toHaveLength(2);
    });

    it('respects RAG_CITATION_CAP_DOCUMENT override', async () => {
      const chunks = Array.from({ length: 10 }, (_, i) => makeChunk(0.9, i));
      const { service } = buildService(
        { RAG_CITATION_CAP_DOCUMENT: '3' },
        chunks,
      );
      const events = await drainStream(
        service.generateAnswerStream('q', 'doc-1', 'ws-1'),
      );
      const done = events.find((e) => 'type' in e && e.type === 'done') as
        | { type: 'done'; citations: unknown[] }
        | undefined;
      expect(done!.citations).toHaveLength(3);
    });

    /**
     * Regression guard for the dropped `<= 3` small-doc fallback.
     * Old behavior: 3 chunks all at similarity 0.35 → all 3 cited (length fallback).
     * New behavior: floor=0.5 drops them all → 0 citations + notFound=true.
     * If anyone reintroduces the length fallback, this test fails immediately.
     *
     * NOTE: We pin RAG_SIMILARITY_FLOOR_FALLBACK to the same value as the
     * primary floor here so the new soft-floor fallback (default 0.3) does
     * NOT relax these chunks back in — that would mask the regression.
     */
    it('regression: 3 chunks at 0.35 with floor 0.5 → zero citations + notFound', async () => {
      const chunks = [makeChunk(0.35, 0), makeChunk(0.35, 1), makeChunk(0.35, 2)];
      const { service } = buildService(
        { RAG_SIMILARITY_FLOOR_FALLBACK: '0.5' },
        chunks,
      );
      const events = await drainStream(
        service.generateAnswerStream('q', 'doc-1', 'ws-1'),
      );
      const done = events.find((e) => 'type' in e && e.type === 'done') as
        | { type: 'done'; citations: unknown[]; notFound: boolean }
        | undefined;
      expect(done!.citations).toHaveLength(0);
      expect(done!.notFound).toBe(true);
    });

    /**
     * MIN_CITATION_SCORE gate (the hardcoded 0.4) takes effect when the
     * configurable floor is intentionally lowered below it.
     */
    it('MIN_CITATION_SCORE gate filters citations when floor is lowered below 0.4', async () => {
      const chunks = [
        makeChunk(0.9, 0),
        makeChunk(0.5, 1),
        makeChunk(0.3, 2), // passes floor=0.2 but below MIN_CITATION_SCORE=0.4
      ];
      const { service } = buildService(
        { RAG_SIMILARITY_FLOOR: '0.2' },
        chunks,
      );
      const events = await drainStream(
        service.generateAnswerStream('q', 'doc-1', 'ws-1'),
      );
      const done = events.find((e) => 'type' in e && e.type === 'done') as
        | { type: 'done'; citations: unknown[] }
        | undefined;
      expect(done!.citations).toHaveLength(2);
    });
  });

  // ---------------------------------------------------------------------------
  // Section E: Clause-aware citations & legal-review structured path
  // ---------------------------------------------------------------------------
  describe('clause-aware citations', () => {
    it('propagates clauseNumber from the chunk into the document citation', async () => {
      const chunks = [
        makeChunk(0.9, 0, { clauseNumber: '9.1.3' } as never),
        makeChunk(0.85, 1, { clauseNumber: '9.1.4' } as never),
      ];
      const { service } = buildService({}, chunks);
      const events = await drainStream(
        service.generateAnswerStream('q', 'doc-1', 'ws-1'),
      );
      const done = events.find((e) => 'type' in e && e.type === 'done') as
        | {
            type: 'done';
            citations: Array<{
              type: 'document';
              clauseNumber?: string;
            }>;
          }
        | undefined;
      expect(done).toBeDefined();
      expect(
        done!.citations.filter((c) => c.type === 'document').map((c) => c.clauseNumber),
      ).toEqual(['9.1.3', '9.1.4']);
    });

    it('omits clauseNumber when the chunk has none (back-compat)', async () => {
      const chunks = [makeChunk(0.9, 0)];
      const { service } = buildService({}, chunks);
      const events = await drainStream(
        service.generateAnswerStream('q', 'doc-1', 'ws-1'),
      );
      const done = events.find((e) => 'type' in e && e.type === 'done') as
        | {
            type: 'done';
            citations: Array<{ clauseNumber?: string }>;
          }
        | undefined;
      const docCitation = done!.citations[0];
      expect(docCitation).toBeDefined();
      expect(docCitation.clauseNumber).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Section F: Observability
  // ---------------------------------------------------------------------------
  describe('observability', () => {
    it('logs retrieved/kept counts after applying the floor', async () => {
      const chunks = [
        makeChunk(0.9, 0),
        makeChunk(0.6, 1),
        makeChunk(0.3, 2), // dropped
      ];
      const { service } = buildService({}, chunks);
      await service.prepareForChat('q', 'doc-1', 'ws-1');
      const filterLogs = logSpy.mock.calls
        .map((args) => String(args[0]))
        .filter((s) => s.includes('retrieved=3 kept=2'));
      expect(filterLogs.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Section G: Pre-flight diagnostic + soft-floor fallback (Phase 1)
  // ---------------------------------------------------------------------------
  describe('pre-flight diagnostic', () => {
    it('emits notFoundReason=no_chunks when the document has zero chunks', async () => {
      const { service, mocks } = buildService({}, []);
      mocks.vectorStore.getDocumentChunkStats.mockResolvedValue({
        total: 0,
        embedded: 0,
      });
      const events = await drainStream(
        service.generateAnswerStream('q', 'doc-1', 'ws-1'),
      );
      const done = events.find((e) => 'type' in e && e.type === 'done') as
        | { type: 'done'; notFound: boolean; notFoundReason?: string }
        | undefined;
      expect(done!.notFound).toBe(true);
      expect(done!.notFoundReason).toBe('no_chunks');
    });

    it('emits notFoundReason=embeddings_pending when chunks exist but some are missing embeddings', async () => {
      const { service, mocks } = buildService({}, []);
      mocks.vectorStore.getDocumentChunkStats.mockResolvedValue({
        total: 10,
        embedded: 4,
      });
      const events = await drainStream(
        service.generateAnswerStream('q', 'doc-1', 'ws-1'),
      );
      const done = events.find((e) => 'type' in e && e.type === 'done') as
        | { type: 'done'; notFound: boolean; notFoundReason?: string }
        | undefined;
      expect(done!.notFound).toBe(true);
      expect(done!.notFoundReason).toBe('embeddings_pending');
    });

    it('emits notFoundReason=below_floor when chunks + embeddings exist but none survive', async () => {
      // Below both floors so the soft-floor fallback also fails.
      const chunks = [makeChunk(0.1, 0), makeChunk(0.05, 1)];
      const { service, mocks } = buildService({}, chunks);
      mocks.vectorStore.getDocumentChunkStats.mockResolvedValue({
        total: 2,
        embedded: 2,
      });
      const events = await drainStream(
        service.generateAnswerStream('q', 'doc-1', 'ws-1'),
      );
      const done = events.find((e) => 'type' in e && e.type === 'done') as
        | { type: 'done'; notFound: boolean; notFoundReason?: string }
        | undefined;
      expect(done!.notFound).toBe(true);
      expect(done!.notFoundReason).toBe('below_floor');
    });

    it('omits notFoundReason when chunks were retrieved (notFound=false)', async () => {
      const chunks = [makeChunk(0.9, 0)];
      const { service } = buildService({}, chunks);
      const events = await drainStream(
        service.generateAnswerStream('q', 'doc-1', 'ws-1'),
      );
      const done = events.find((e) => 'type' in e && e.type === 'done') as
        | { type: 'done'; notFound: boolean; notFoundReason?: string }
        | undefined;
      expect(done!.notFound).toBe(false);
      expect(done!.notFoundReason).toBeUndefined();
    });
  });

  describe('soft-floor fallback', () => {
    it('relaxes to RAG_SIMILARITY_FLOOR_FALLBACK when no chunks survive the primary floor', async () => {
      // Primary 0.5 drops everything; default fallback 0.3 keeps 0.4 and 0.35.
      const chunks = [makeChunk(0.4, 0), makeChunk(0.35, 1), makeChunk(0.1, 2)];
      const { service } = buildService({}, chunks);
      const events = await drainStream(
        service.generateAnswerStream('q', 'doc-1', 'ws-1'),
      );
      const done = events.find((e) => 'type' in e && e.type === 'done') as
        | {
            type: 'done';
            notFound: boolean;
            citations: unknown[];
            confidence: 'high' | 'medium' | 'low';
          }
        | undefined;
      expect(done!.notFound).toBe(false);
      // Soft-floor fallback caps confidence at 'low' regardless of count.
      expect(done!.confidence).toBe('low');
    });

    it('does NOT relax when the primary floor already returned chunks', async () => {
      const chunks = [makeChunk(0.9, 0), makeChunk(0.4, 1)];
      const { service } = buildService({}, chunks);
      const events = await drainStream(
        service.generateAnswerStream('q', 'doc-1', 'ws-1'),
      );
      const done = events.find((e) => 'type' in e && e.type === 'done') as
        | { type: 'done'; citations: unknown[]; confidence: 'high' | 'medium' | 'low' }
        | undefined;
      expect(done!.citations).toHaveLength(1);
      // Single high-similarity chunk → high confidence (no fallback fired).
      expect(done!.confidence).toBe('high');
    });

    it('disables the fallback when RAG_SIMILARITY_FLOOR_FALLBACK >= primary floor', async () => {
      const chunks = [makeChunk(0.4, 0), makeChunk(0.35, 1)];
      const { service } = buildService(
        { RAG_SIMILARITY_FLOOR_FALLBACK: '0.5' },
        chunks,
      );
      const events = await drainStream(
        service.generateAnswerStream('q', 'doc-1', 'ws-1'),
      );
      const done = events.find((e) => 'type' in e && e.type === 'done') as
        | { type: 'done'; notFound: boolean }
        | undefined;
      expect(done!.notFound).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Section H: Web search integration (Phase 2)
  // ---------------------------------------------------------------------------
  describe('web search integration', () => {
    it('does not call web search when WEB_SEARCH_TRIGGER is unset (off by default)', async () => {
      const chunks = [makeChunk(0.9, 0)];
      const { service, mocks } = buildService({}, chunks);
      mocks.webSearchService.isEnabled.mockReturnValue(true);
      await drainStream(service.generateAnswerStream('q', 'doc-1', 'ws-1'));
      expect(mocks.webSearchService.search).not.toHaveBeenCalled();
    });

    it('calls web search and adds web citations when trigger=always and service is enabled', async () => {
      const chunks = [makeChunk(0.9, 0)];
      const { service, mocks } = buildService(
        { WEB_SEARCH_TRIGGER: 'always' },
        chunks,
      );
      mocks.webSearchService.isEnabled.mockReturnValue(true);
      mocks.webSearchService.search.mockResolvedValue([
        {
          title: 'Pensions Authority',
          url: 'https://pensionsauthority.ie',
          snippet: 'Auto-enrolment from 2024.',
          score: 0.9,
        },
      ]);
      const events = await drainStream(
        service.generateAnswerStream('q', 'doc-1', 'ws-1'),
      );
      expect(mocks.webSearchService.search).toHaveBeenCalledWith(
        'q',
        expect.objectContaining({ jurisdiction: undefined }),
      );
      const done = events.find((e) => 'type' in e && e.type === 'done') as
        | {
            type: 'done';
            citations: Array<{ type: string; url?: string; title?: string }>;
          }
        | undefined;
      const webCitations = done!.citations.filter((c) => c.type === 'web');
      expect(webCitations).toHaveLength(1);
      expect(webCitations[0].url).toBe('https://pensionsauthority.ie');
    });

    it('runs web search but discards results in fallback mode when local retrieval is rich (>=2 chunks)', async () => {
      const chunks = [makeChunk(0.9, 0), makeChunk(0.8, 1)];
      const { service, mocks } = buildService(
        { WEB_SEARCH_TRIGGER: 'fallback' },
        chunks,
      );
      mocks.webSearchService.isEnabled.mockReturnValue(true);
      mocks.webSearchService.search.mockResolvedValue([
        { title: 'X', url: 'https://x', snippet: 'y' },
      ]);
      const events = await drainStream(
        service.generateAnswerStream('q', 'doc-1', 'ws-1'),
      );
      // Search runs in parallel with vector retrieval, then gets gated out.
      expect(mocks.webSearchService.search).toHaveBeenCalled();
      const done = events.find((e) => 'type' in e && e.type === 'done') as
        | { type: 'done'; citations: Array<{ type: string }> }
        | undefined;
      expect(done!.citations.filter((c) => c.type === 'web')).toHaveLength(0);
    });

    it('keeps web results in fallback mode when local retrieval is sparse (<2 chunks)', async () => {
      const chunks = [makeChunk(0.9, 0)];
      const { service, mocks } = buildService(
        { WEB_SEARCH_TRIGGER: 'fallback' },
        chunks,
      );
      mocks.webSearchService.isEnabled.mockReturnValue(true);
      mocks.webSearchService.search.mockResolvedValue([
        { title: 'X', url: 'https://x', snippet: 'y' },
      ]);
      const events = await drainStream(
        service.generateAnswerStream('q', 'doc-1', 'ws-1'),
      );
      const done = events.find((e) => 'type' in e && e.type === 'done') as
        | { type: 'done'; citations: Array<{ type: string }> }
        | undefined;
      expect(done!.citations.filter((c) => c.type === 'web')).toHaveLength(1);
    });

    it('treats web-only results as found (notFound=false)', async () => {
      // No usable local chunks but web search returned a hit.
      const { service, mocks } = buildService(
        { WEB_SEARCH_TRIGGER: 'always' },
        [],
      );
      mocks.vectorStore.getDocumentChunkStats.mockResolvedValue({
        total: 5,
        embedded: 5,
      });
      mocks.webSearchService.isEnabled.mockReturnValue(true);
      mocks.webSearchService.search.mockResolvedValue([
        { title: 'X', url: 'https://x', snippet: 'y' },
      ]);
      const events = await drainStream(
        service.generateAnswerStream('q', 'doc-1', 'ws-1'),
      );
      const done = events.find((e) => 'type' in e && e.type === 'done') as
        | { type: 'done'; notFound: boolean }
        | undefined;
      expect(done!.notFound).toBe(false);
    });

    it('passes the jurisdiction through to WebSearchService', async () => {
      const chunks = [makeChunk(0.9, 0)];
      const { service, mocks } = buildService(
        { WEB_SEARCH_TRIGGER: 'always' },
        chunks,
      );
      mocks.webSearchService.isEnabled.mockReturnValue(true);
      mocks.webSearchService.search.mockResolvedValue([]);
      await drainStream(
        service.generateAnswerStream('q', 'doc-1', 'ws-1', 'IE'),
      );
      expect(mocks.webSearchService.search).toHaveBeenCalledWith(
        'q',
        expect.objectContaining({ jurisdiction: 'IE' }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Section I: Statute hint derivation for web search (Tier 2 reliability fix)
  // ---------------------------------------------------------------------------
  /**
   * Verifies that RagService mines short statute identifiers from the
   * retrieved RAG context and forwards them to WebSearchService. This is what
   * lets Tavily anchor on `.gov` sources (e.g. searches for "Pensions Act
   * 1990 Ireland law 2026" instead of the bare "pension Ireland law 2026").
   *
   * Hint sources, in priority order:
   *   1. legalChunks[*].actName (curated corpus — preferred, safer)
   *   2. regex over document chunk text (fallback, whitelist-only)
   *
   * Hard caps: ≤ 2 hints total; deduped case-insensitively.
   */
  describe('statute hint derivation (Tier 2)', () => {
    /** Helper: extract the options arg from the most recent webSearch call. */
    function lastSearchOptions(mocks: MockBag): {
      statuteHints?: string[];
      jurisdiction?: string;
    } | undefined {
      const calls = mocks.webSearchService.search.mock.calls;
      if (calls.length === 0) return undefined;
      return calls[calls.length - 1][1] as {
        statuteHints?: string[];
        jurisdiction?: string;
      };
    }

    it('forwards actName + actYear from legal chunks as the primary hint source', async () => {
      const docChunks = [makeChunk(0.9, 0)];
      const legalChunks: LegalChunkSearchResult[] = [
        {
          ...makeLegalChunk(0.85, 0),
          actName: 'Pensions Act',
          actYear: 1990,
          // The runtime reads actYear from `item`, mirror it there too.
          item: {
            id: 'legal-0',
            text: 'legal text 0',
            section: 's-0',
            actYear: 1990,
          } as unknown as LegalChunkSearchResult['item'],
        },
      ];
      const { service, mocks } = buildService(
        { WEB_SEARCH_TRIGGER: 'always' },
        docChunks,
        legalChunks,
      );
      mocks.webSearchService.isEnabled.mockReturnValue(true);
      mocks.webSearchService.search.mockResolvedValue([]);

      await drainStream(
        service.generateAnswerStream('pension q', 'doc-1', 'ws-1', 'IE'),
      );

      const opts = lastSearchOptions(mocks);
      expect(opts?.statuteHints).toEqual(['Pensions Act 1990']);
    });

    it('caps forwarded hints at 2 even when more legal chunks match', async () => {
      const docChunks = [makeChunk(0.9, 0)];
      const legalChunks: LegalChunkSearchResult[] = [
        { ...makeLegalChunk(0.9, 0), actName: 'Pensions Act', actYear: 1990 },
        {
          ...makeLegalChunk(0.85, 1),
          actName: 'Employment Equality Act',
          actYear: 1998,
        },
        {
          ...makeLegalChunk(0.8, 2),
          actName: 'Industrial Relations Act',
          actYear: 1990,
        },
      ];
      const { service, mocks } = buildService(
        { WEB_SEARCH_TRIGGER: 'always' },
        docChunks,
        legalChunks,
      );
      mocks.webSearchService.isEnabled.mockReturnValue(true);
      mocks.webSearchService.search.mockResolvedValue([]);

      await drainStream(
        service.generateAnswerStream('q', 'doc-1', 'ws-1', 'IE'),
      );

      const opts = lastSearchOptions(mocks);
      expect(opts?.statuteHints).toHaveLength(2);
      expect(opts?.statuteHints).toEqual([
        'Pensions Act 1990',
        'Employment Equality Act 1998',
      ]);
    });

    it('deduplicates legal-chunk hints case-insensitively', async () => {
      const docChunks = [makeChunk(0.9, 0)];
      const legalChunks: LegalChunkSearchResult[] = [
        { ...makeLegalChunk(0.9, 0), actName: 'Pensions Act', actYear: 1990 },
        // Same act surfaced from a different section (very common in the
        // legal corpus): must collapse to a single hint.
        { ...makeLegalChunk(0.85, 1), actName: 'PENSIONS ACT', actYear: 1990 },
      ];
      const { service, mocks } = buildService(
        { WEB_SEARCH_TRIGGER: 'always' },
        docChunks,
        legalChunks,
      );
      mocks.webSearchService.isEnabled.mockReturnValue(true);
      mocks.webSearchService.search.mockResolvedValue([]);

      await drainStream(
        service.generateAnswerStream('q', 'doc-1', 'ws-1', 'IE'),
      );

      expect(lastSearchOptions(mocks)?.statuteHints).toEqual([
        'Pensions Act 1990',
      ]);
    });

    it('falls back to a regex over document chunks when no legal chunks have actName', async () => {
      const docChunks = [
        makeChunk(0.9, 0, {
          text:
            'The Employee shall be enrolled in a pension scheme as required by the Pensions Act 1990.',
        } as Partial<Chunk>),
        makeChunk(0.85, 1, {
          text: 'Disputes governed by the Workplace Relations Act 2015.',
        } as Partial<Chunk>),
      ];
      const { service, mocks } = buildService(
        { WEB_SEARCH_TRIGGER: 'always' },
        docChunks,
        [], // No legal chunks → regex fallback.
      );
      mocks.webSearchService.isEnabled.mockReturnValue(true);
      mocks.webSearchService.search.mockResolvedValue([]);

      await drainStream(
        service.generateAnswerStream('pension', 'doc-1', 'ws-1', 'IE'),
      );

      const opts = lastSearchOptions(mocks);
      expect(opts?.statuteHints).toEqual([
        'Pensions Act 1990',
        'Workplace Relations Act 2015',
      ]);
    });

    it('regex fallback does not surface lowercase / sentence-fragment matches (PII guard)', async () => {
      const docChunks = [
        makeChunk(0.9, 0, {
          text:
            'Salary: 75000 EUR. The party John Smith of 12 Main Street agrees that pensions act as deferred wages.',
        } as Partial<Chunk>),
      ];
      const { service, mocks } = buildService(
        { WEB_SEARCH_TRIGGER: 'always' },
        docChunks,
        [],
      );
      mocks.webSearchService.isEnabled.mockReturnValue(true);
      mocks.webSearchService.search.mockResolvedValue([]);

      await drainStream(
        service.generateAnswerStream('q', 'doc-1', 'ws-1', 'IE'),
      );

      const hints = lastSearchOptions(mocks)?.statuteHints ?? [];
      // No statute pattern matches the lowercased "pensions act" + no year,
      // and we must NOT surface salary or party name fragments.
      expect(hints).toEqual([]);
      expect(hints.join(' ')).not.toMatch(/John Smith|75000|Main Street/i);
    });

    it('combines legal-chunk and doc-regex hints: legal chunks first, then regex tops up to 2', async () => {
      const docChunks = [
        makeChunk(0.9, 0, {
          text: 'Disputes governed by the Workplace Relations Act 2015.',
        } as Partial<Chunk>),
      ];
      const legalChunks: LegalChunkSearchResult[] = [
        { ...makeLegalChunk(0.9, 0), actName: 'Pensions Act', actYear: 1990 },
      ];
      const { service, mocks } = buildService(
        { WEB_SEARCH_TRIGGER: 'always' },
        docChunks,
        legalChunks,
      );
      mocks.webSearchService.isEnabled.mockReturnValue(true);
      mocks.webSearchService.search.mockResolvedValue([]);

      await drainStream(
        service.generateAnswerStream('q', 'doc-1', 'ws-1', 'IE'),
      );

      expect(lastSearchOptions(mocks)?.statuteHints).toEqual([
        'Pensions Act 1990',
        'Workplace Relations Act 2015',
      ]);
    });

    it('forwards an empty hints array when nothing usable is found', async () => {
      const docChunks = [
        makeChunk(0.9, 0, { text: 'Generic boilerplate without statutes.' } as Partial<Chunk>),
      ];
      const { service, mocks } = buildService(
        { WEB_SEARCH_TRIGGER: 'always' },
        docChunks,
        [],
      );
      mocks.webSearchService.isEnabled.mockReturnValue(true);
      mocks.webSearchService.search.mockResolvedValue([]);

      await drainStream(
        service.generateAnswerStream('q', 'doc-1', 'ws-1', 'IE'),
      );

      const opts = lastSearchOptions(mocks);
      expect(opts?.statuteHints).toEqual([]);
    });

    it('does not derive hints when web search is disabled (no wasted CPU)', async () => {
      const docChunks = [
        makeChunk(0.9, 0, {
          text: 'The Pensions Act 1990 governs scheme contributions.',
        } as Partial<Chunk>),
      ];
      const { service, mocks } = buildService({}, docChunks, []);
      // trigger=off (default) AND isEnabled=true: still no call expected.
      mocks.webSearchService.isEnabled.mockReturnValue(true);

      await drainStream(
        service.generateAnswerStream('q', 'doc-1', 'ws-1', 'IE'),
      );

      expect(mocks.webSearchService.search).not.toHaveBeenCalled();
    });
  });
});
