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
  embeddingsService: { generateEmbedding: jest.Mock };
  promptService: {
    getChatPrompts: jest.Mock;
    getLanguageName: jest.Mock;
  };
  workspaceSettingsService: { getSettings: jest.Mock };
  configService: { get: jest.Mock };
  ragCacheService: { get: jest.Mock; set: jest.Mock };
  chatPrepareCacheService: { set: jest.Mock; getAndDelete: jest.Mock };
  llmProviderRegistry: { resolveProvider: jest.Mock };
  memoryService: { getDocumentAndThreadMemory: jest.Mock };
  legalReviewModelResolver: { resolve: jest.Mock };
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
  const vectorStore = {
    searchDocumentChunks: jest.fn().mockResolvedValue(chunkResults),
    searchLegalChunks: jest.fn().mockResolvedValue(legalResults),
  } as unknown as jest.Mocked<IVectorStore>;

  const mocks: MockBag = {
    vectorStore,
    documentRepository: {
      findOne: jest.fn().mockResolvedValue({ id: 'doc-1', title: 'Doc 1' }),
    },
    embeddingsService: {
      generateEmbedding: jest.fn().mockResolvedValue([0.1, 0.2, 0.3]),
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
    },
    memoryService: {
      getDocumentAndThreadMemory: jest.fn().mockResolvedValue(null),
    },
    legalReviewModelResolver: {
      resolve: jest.fn().mockReturnValue(undefined),
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
        { country: undefined, jurisdiction: 'BR' },
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
      const chunks = [makeChunk(0.3, 0), makeChunk(0.2, 1)];
      const { service } = buildService({}, chunks);
      const events = await drainStream(
        service.generateAnswerStream('q', 'doc-1', 'ws-1'),
      );
      const done = events.find((e) => 'type' in e && e.type === 'done') as
        | { type: 'done'; notFound: boolean; citations: unknown[] }
        | undefined;
      expect(done).toBeDefined();
      expect(done!.notFound).toBe(true);
      expect(done!.citations).toEqual([]);
    });

    it('does NOT call ragCacheService.set when notFound=true', async () => {
      const chunks = [makeChunk(0.3, 0)];
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
     */
    it('regression: 3 chunks at 0.35 with floor 0.5 → zero citations + notFound', async () => {
      const chunks = [makeChunk(0.35, 0), makeChunk(0.35, 1), makeChunk(0.35, 2)];
      const { service } = buildService({}, chunks);
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
});
