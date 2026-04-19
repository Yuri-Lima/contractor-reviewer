import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Chunk } from '../entities/chunk.entity';
import { Document } from '../entities/document.entity';
import {
  ChatPreparePayload,
  ChatPrepareResponse,
  Citation,
  ChatResponse,
  DocumentCitation,
  LegalSourceCitation,
  type StreamEvent,
} from '@contractai-review/shared';
import { EmbeddingsService } from './embeddings.service';
import { PromptService } from '../prompts/prompt.service';
import { RagCacheService } from '../cache/rag-cache.service';
import { ChatPrepareCacheService } from './chat-prepare-cache.service';
import { WorkspaceSettingsService } from '../workspace/workspace-settings.service';
import {
  IVectorStore,
  LegalChunkSearchResult,
  VECTOR_STORE,
  VectorSearchResult,
} from '../vector-store/vector-store.interface';
import { LlmProviderRegistry } from '../llm/llm-provider.registry';
import { MemoryService } from '../memory/memory.service';
import { parseEnvFloat, parseEnvInt } from '../common/utils/config-utils';

// Re-export for backward compatibility
export type { Citation };
export type RagResponse = ChatResponse;

const DEFAULT_LLM_MAX_TOKENS = 2000;

/**
 * Minimum similarity score to surface a chunk as a citation in the UI.
 * Distinct from RAG_SIMILARITY_FLOOR (which gates what reaches the LLM).
 *
 * Rationale: the floor controls *retrieval quality* (what we ask the LLM to
 * reason over); MIN_CITATION_SCORE controls *citation quality shown to users*.
 * With the default floor (0.5) > MIN_CITATION_SCORE (0.4), this gate is
 * dead-code by default — it only matters if an operator intentionally lowers
 * RAG_SIMILARITY_FLOOR below 0.4. Kept as a defensive minimum so a misconfigured
 * floor can't cause us to surface obviously irrelevant snippets to the user.
 */
const MIN_CITATION_SCORE = 0.4;

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);
  private readonly chatModel: string;
  private readonly maxTokens: number;
  private readonly topKDocument: number;
  private readonly topKLegal: number;
  private readonly similarityFloor: number;
  private readonly citationCapDocument: number;
  private readonly citationCapLegal: number;

  constructor(
    @Inject(VECTOR_STORE)
    private vectorStore: IVectorStore,
    @InjectRepository(Document)
    private documentRepository: Repository<Document>,
    private embeddingsService: EmbeddingsService,
    private promptService: PromptService,
    private workspaceSettingsService: WorkspaceSettingsService,
    private configService: ConfigService,
    private ragCacheService: RagCacheService,
    private chatPrepareCacheService: ChatPrepareCacheService,
    private llmProviderRegistry: LlmProviderRegistry,
    private memoryService: MemoryService,
  ) {
    this.chatModel = this.configService.get<string>('OPENAI_CHAT_MODEL') || 'gpt-4o-mini';
    const raw = this.configService.get<string>('LLM_MAX_TOKENS');
    const parsed = raw ? parseInt(raw, 10) : DEFAULT_LLM_MAX_TOKENS;
    this.maxTokens = parsed > 0 ? parsed : DEFAULT_LLM_MAX_TOKENS;

    this.topKDocument = parseEnvInt(
      'RAG_TOP_K_DOCUMENT',
      this.configService.get<string>('RAG_TOP_K_DOCUMENT'),
      8,
      { max: 50 },
    );
    this.topKLegal = parseEnvInt(
      'RAG_TOP_K_LEGAL',
      this.configService.get<string>('RAG_TOP_K_LEGAL'),
      3,
      { max: 20 },
    );
    this.similarityFloor = parseEnvFloat(
      'RAG_SIMILARITY_FLOOR',
      this.configService.get<string>('RAG_SIMILARITY_FLOOR'),
      0.5,
    );
    this.citationCapDocument = parseEnvInt(
      'RAG_CITATION_CAP_DOCUMENT',
      this.configService.get<string>('RAG_CITATION_CAP_DOCUMENT'),
      5,
      { max: 20 },
    );
    this.citationCapLegal = parseEnvInt(
      'RAG_CITATION_CAP_LEGAL',
      this.configService.get<string>('RAG_CITATION_CAP_LEGAL'),
      2,
      { max: 20 },
    );

    this.logger.log(
      `[RagConfig] topKDocument=${this.topKDocument} topKLegal=${this.topKLegal} ` +
        `similarityFloor=${this.similarityFloor} ` +
        `citationCapDocument=${this.citationCapDocument} citationCapLegal=${this.citationCapLegal}`,
    );
  }

  /**
   * Filter retrieved results by configured similarity floor.
   *
   * NOTE: The `distance` field on VectorSearchResult is a misnomer — it actually
   * contains cosine SIMILARITY (1 - cosine_distance), where higher = more similar.
   * See pgvector-store.service.ts: `1 - (embedding <=> query) AS distance`.
   * Renaming the field is tracked as a follow-up; for now, every comparison in
   * this file uses `> threshold` because the field is similarity, not distance.
   *
   * Strict `>` (not `>=`) so RAG_SIMILARITY_FLOOR=0 means "keep all chunks".
   */
  private applySimilarityFloor<T extends { distance: number }>(
    results: T[],
  ): T[] {
    return results.filter((r) => r.distance > this.similarityFloor);
  }

  /**
   * Search for similar document chunks using vector similarity.
   * `limit` is intentionally required (no default) — every caller must pass
   * `this.topKDocument` so future callers can't silently inherit a magic number.
   */
  async searchDocumentChunks(
    queryEmbedding: number[],
    documentId: string,
    limit: number,
  ): Promise<VectorSearchResult<Chunk>[]> {
    return this.vectorStore.searchDocumentChunks(queryEmbedding, documentId, limit);
  }

  /**
   * Search for similar legal source chunks.
   * `limit` is intentionally required (no default) — every caller must pass
   * `this.topKLegal` so future callers can't silently inherit a magic number.
   */
  async searchLegalChunks(
    queryEmbedding: number[],
    country: string | undefined,
    jurisdiction: string | undefined,
    limit: number,
  ): Promise<LegalChunkSearchResult[]> {
    return this.vectorStore.searchLegalChunks(
      queryEmbedding,
      { country, jurisdiction },
      limit,
    );
  }

  /**
   * Prepare RAG payload for dev mode inspection (no LLM call).
   * Skips semantic cache; always does fresh retrieval.
   */
  async prepareForChat(
    question: string,
    documentId: string,
    workspaceId: string,
    jurisdiction?: string,
    language: string = 'en',
    options?: { signal?: AbortSignal },
  ): Promise<ChatPrepareResponse> {
    const questionEmbedding = await this.embeddingsService.generateEmbedding(
      question,
      options,
    );

    const rawDocumentChunks = await this.searchDocumentChunks(
      questionEmbedding,
      documentId,
      this.topKDocument,
    );
    const documentChunks = this.applySimilarityFloor(rawDocumentChunks);
    this.logger.log(
      `[prepareForChat] documentChunks retrieved=${rawDocumentChunks.length} kept=${documentChunks.length} ` +
        `floor=${this.similarityFloor} topK=${this.topKDocument}`,
    );

    const rawLegalChunks = jurisdiction
      ? await this.searchLegalChunks(
          questionEmbedding,
          undefined,
          jurisdiction,
          this.topKLegal,
        )
      : [];
    const legalChunks = this.applySimilarityFloor(rawLegalChunks);
    if (jurisdiction) {
      this.logger.log(
        `[prepareForChat] legalChunks retrieved=${rawLegalChunks.length} kept=${legalChunks.length} ` +
          `floor=${this.similarityFloor} topK=${this.topKLegal}`,
      );
    }

    const documentContext = documentChunks
      .map((c, i) => `[Document Excerpt ${i + 1}]: ${c.item.text}`)
      .join('\n\n');
    const legalContext = legalChunks
      .map((c, i) => `[Legal Source ${i + 1}]: ${c.item.text}`)
      .join('\n\n');
    const context = [documentContext, legalContext].filter(Boolean).join('\n\n');

    const [workspaceSettings, document] = await Promise.all([
      this.workspaceSettingsService.getSettings(workspaceId),
      this.documentRepository.findOne({ where: { id: documentId } }),
    ]);

    const scopeFlags =
      workspaceSettings || document
        ? {
            includeGlobal: workspaceSettings?.promptScopeIncludeGlobal ?? true,
            includeWorkspace: workspaceSettings?.promptScopeIncludeWorkspace ?? true,
            includeDocument: (document as { promptScopeIncludeDocument?: boolean })?.promptScopeIncludeDocument ?? true,
          }
        : undefined;

    const languageName = this.promptService.getLanguageName(language);
    const { system, user } = await this.promptService.getChatPrompts(
      {
        languageName,
        context: context || 'No relevant context found.',
        question,
      },
      { workspaceId, documentId, scopeFlags },
    );

    const payload: ChatPreparePayload = {
      systemPrompt: system,
      userPrompt: user,
      documentChunks: documentChunks.map((c) => ({
        text: c.item.text,
        pageNumber: c.item.pageNumber ?? undefined,
        paragraphId: c.item.paragraphId ?? undefined,
        similarity: c.distance,
      })),
      legalChunks: legalChunks.map((c) => ({
        text: c.item.text,
        sourceName: c.sourceName ?? undefined,
        section: c.item.section ?? c.section ?? undefined,
        url: c.url ?? undefined,
        similarity: c.distance,
      })),
      question,
      model: this.chatModel,
      temperature: 0.3,
      maxTokens: this.maxTokens,
    };

    const requestId = await this.chatPrepareCacheService.set(
      workspaceId,
      documentId,
      payload,
    );

    return { requestId, payload };
  }

  /**
   * Execute prepared chat (call LLM with cached payload). One-time use.
   */
  async executePreparedChat(
    workspaceId: string,
    documentId: string,
    requestId: string,
    options?: { signal?: AbortSignal },
  ): Promise<{ response: RagResponse; question: string }> {
    const payload = await this.chatPrepareCacheService.getAndDelete(
      workspaceId,
      documentId,
      requestId,
    );

    if (!payload) {
      this.logger.log('[RAG] Execute payload expired or invalid', {
        requestId,
        documentId,
      });
      throw new BadRequestException(
        'Preparation expired or invalid. Please submit your question again.',
      );
    }

    this.logger.log('[RAG] Execute payload consumed', { requestId, documentId });

    const answerText = await this.callLlm(
      payload.systemPrompt,
      payload.userPrompt,
      workspaceId,
      { ...options, documentId },
    );

    const documentChunks = payload.documentChunks;
    const legalChunks = payload.legalChunks;
    const hasGoodMatches =
      documentChunks.length > 0 && documentChunks[0].similarity > 0.7;
    const hasLegalMatches =
      legalChunks.length > 0 && legalChunks[0].similarity > 0.7;
    const hasAnyMatches = documentChunks.length > 0 || legalChunks.length > 0;
    const hasMediumMatches =
      (documentChunks.length > 0 && documentChunks[0].similarity > 0.5) ||
      (legalChunks.length > 0 && legalChunks[0].similarity > 0.5);
    const hasMultipleChunks = documentChunks.length >= 2;

    let confidence: 'high' | 'medium' | 'low' = 'low';
    if (hasGoodMatches && hasLegalMatches) {
      confidence = 'high';
    } else if (hasGoodMatches || hasLegalMatches) {
      confidence = 'high';
    } else if (hasMediumMatches || hasMultipleChunks) {
      confidence = 'medium';
    } else if (hasAnyMatches) {
      confidence = 'low';
    }

    const document = await this.documentRepository.findOne({
      where: { id: documentId },
    });
    const citations: Citation[] = [];

    for (const result of documentChunks.slice(0, this.citationCapDocument)) {
      if (result.similarity > MIN_CITATION_SCORE) {
        citations.push({
          type: 'document',
          fileName: document?.title,
          pageNumber: result.pageNumber,
          paragraphId: result.paragraphId,
          quoteSnippet: result.text.substring(0, 200) + '...',
        } satisfies DocumentCitation);
      }
    }

    for (const result of legalChunks.slice(0, this.citationCapLegal)) {
      if (result.similarity > MIN_CITATION_SCORE) {
        citations.push({
          type: 'legal',
          sourceName: result.sourceName,
          section: result.section,
          url: result.url,
          quoteSnippet: result.text.substring(0, 200) + '...',
        } satisfies LegalSourceCitation);
      }
    }

    return {
      response: {
        answerText,
        confidence,
        citations,
        notFound: documentChunks.length === 0 && legalChunks.length === 0,
        fromCache: false,
      },
      question: payload.question,
    };
  }

  private logRagError(
    operation: string,
    documentId: string,
    workspaceId: string,
    error: unknown,
  ): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`RAG ${operation} error (documentId, workspaceId):`, documentId, workspaceId, errorMessage);
  }

  /**
   * Log full LLM context (system + user prompts) when LOG_LLM_PROMPT_CONTEXT=true.
   * Enable for debugging: LOG_LLM_PROMPT_CONTEXT=true in .env
   */
  private logLlmPromptContextWhenEnabled(
    system: string,
    user: string,
    context?: { documentId?: string; workspaceId?: string; model?: string },
  ): void {
    if (this.configService.get<string>('LOG_LLM_PROMPT_CONTEXT') !== 'true') {
      return;
    }
    const { documentId, workspaceId, model } = context ?? {};
    this.logger.log(
      `[LLM_CONTEXT] documentId=${documentId ?? 'n/a'} workspaceId=${workspaceId ?? 'n/a'} model=${model ?? this.chatModel}`,
    );
    this.logger.log(`[LLM_CONTEXT] === SYSTEM PROMPT (${system.length} chars) ===\n${system}`);
    this.logger.log(`[LLM_CONTEXT] === USER PROMPT (${user.length} chars) ===\n${user}`);
    this.logger.log(`[LLM_CONTEXT] === END CONTEXT ===`);
  }

  /**
   * Stream answer using RAG. Yields chunk/done/error events.
   * Cache hit: yields done event with full response. Cache miss: streams from LLM.
   */
  async *generateAnswerStream(
    question: string,
    documentId: string,
    workspaceId: string,
    jurisdiction?: string,
    language: string = 'en',
    options?: {
      signal?: AbortSignal;
      forceFresh?: boolean;
      similarityThreshold?: number;
      conversationHistory?: string;
      /** Thread ID for memory injection (document/thread memory) */
      threadId?: string;
    },
  ): AsyncIterable<StreamEvent> {
    try {
      this.logger.log(
        `[generateAnswerStream] Generate question embedding: documentId=${documentId} workspaceId=${workspaceId}`,
      );
      const questionEmbedding = await this.embeddingsService.generateEmbedding(
        question,
        options,
      );

      this.logger.log(
        `[generateAnswerStream] Check semantic cache: documentId=${documentId} forceFresh=${options?.forceFresh ?? false}`,
      );
      if (!options?.forceFresh) {
        const cached = await this.ragCacheService.get(
          documentId,
          jurisdiction,
          questionEmbedding,
          language,
          { similarityThreshold: options?.similarityThreshold },
        );
        if (cached) {
          this.logger.log(
            `[generateAnswerStream] Cache hit: documentId=${documentId} answerLength=${cached.answerText?.length ?? 0}`,
          );
          yield { type: 'chunk', content: cached.answerText };
          yield {
            type: 'done',
            answerText: cached.answerText,
            confidence: cached.confidence,
            citations: cached.citations ?? [],
            notFound: cached.notFound ?? false,
            fromCache: true,
          };
          return;
        }
      }

      this.logger.log(
        `[generateAnswerStream] Search document chunks (vector store): documentId=${documentId}`,
      );
      const rawDocumentChunks = await this.searchDocumentChunks(
        questionEmbedding,
        documentId,
        this.topKDocument,
      );
      const documentChunks = this.applySimilarityFloor(rawDocumentChunks);
      this.logger.log(
        `[generateAnswerStream] documentChunks documentId=${documentId} retrieved=${rawDocumentChunks.length} kept=${documentChunks.length} ` +
          `floor=${this.similarityFloor} topK=${this.topKDocument}`,
      );
      this.logger.log(
        `[generateAnswerStream] Search legal chunks (vector store): documentId=${documentId} jurisdiction=${jurisdiction ?? 'none'}`,
      );
      const rawLegalChunks = jurisdiction
        ? await this.searchLegalChunks(
            questionEmbedding,
            undefined,
            jurisdiction,
            this.topKLegal,
          )
        : [];
      const legalChunks = this.applySimilarityFloor(rawLegalChunks);
      if (jurisdiction) {
        this.logger.log(
          `[generateAnswerStream] legalChunks documentId=${documentId} retrieved=${rawLegalChunks.length} kept=${legalChunks.length} ` +
            `floor=${this.similarityFloor} topK=${this.topKLegal}`,
        );
      }

      const hasGoodMatches =
        documentChunks.length > 0 && documentChunks[0].distance > 0.7;
      const hasLegalMatches =
        legalChunks.length > 0 && legalChunks[0].distance > 0.7;
      const hasAnyMatches = documentChunks.length > 0 || legalChunks.length > 0;
      const hasMediumMatches =
        (documentChunks.length > 0 && documentChunks[0].distance > 0.5) ||
        (legalChunks.length > 0 && legalChunks[0].distance > 0.5);
      const hasMultipleChunks = documentChunks.length >= 2;

      let confidence: 'high' | 'medium' | 'low' = 'low';
      if (hasGoodMatches || hasLegalMatches) confidence = 'high';
      else if (hasMediumMatches || hasMultipleChunks) confidence = 'medium';
      else if (hasAnyMatches) confidence = 'low';

      const doc = await this.documentRepository.findOne({
        where: { id: documentId },
      });
      const citations: Citation[] = [];
      for (const result of documentChunks.slice(0, this.citationCapDocument)) {
        if (result.distance > MIN_CITATION_SCORE) {
          citations.push({
            type: 'document',
            fileName: doc?.title,
            pageNumber: result.item.pageNumber,
            paragraphId: result.item.paragraphId,
            quoteSnippet: result.item.text.substring(0, 200) + '...',
          } satisfies DocumentCitation);
        }
      }
      for (const result of legalChunks.slice(0, this.citationCapLegal)) {
        if (result.distance > MIN_CITATION_SCORE) {
          citations.push({
            type: 'legal',
            sourceName: result.sourceName,
            section: result.item.section || result.section,
            url: result.url,
            quoteSnippet: result.item.text.substring(0, 200) + '...',
          });
        }
      }

      const [workspaceSettings, docForScope] = await Promise.all([
        this.workspaceSettingsService.getSettings(workspaceId),
        this.documentRepository.findOne({ where: { id: documentId } }),
      ]);
      const scopeFlags =
        workspaceSettings || docForScope
          ? {
              includeGlobal: workspaceSettings?.promptScopeIncludeGlobal ?? true,
              includeWorkspace: workspaceSettings?.promptScopeIncludeWorkspace ?? true,
              includeDocument: (docForScope as { promptScopeIncludeDocument?: boolean })?.promptScopeIncludeDocument ?? true,
            }
          : undefined;

      let context =
        [
          documentChunks.map((c, i) => `[Document Excerpt ${i + 1}]: ${c.item.text}`).join('\n\n'),
          legalChunks.map((c, i) => `[Legal Source ${i + 1}]: ${c.item.text}`).join('\n\n'),
        ]
          .filter(Boolean)
          .join('\n\n') || 'No relevant context found.';

      const memorySection = await this.memoryService.getDocumentAndThreadMemory(
        documentId,
        options?.threadId ?? null,
      );
      if (memorySection) {
        context = `${memorySection}\n\n---\n\n${context}`;
      }

      this.logger.log(
        `[generateAnswerStream] Resolve LLM provider via workspace settings: workspaceId=${workspaceId}`,
      );
      const provider = await this.llmProviderRegistry.resolveProvider(workspaceId);
      this.logger.log(
        `[generateAnswerStream] Build system + user prompts: documentId=${documentId} workspaceId=${workspaceId}`,
      );
      const { system, user } = await this.promptService.getChatPrompts(
        {
          languageName: this.promptService.getLanguageName(language),
          context,
          question,
          conversationHistory: options?.conversationHistory,
        },
        { workspaceId, documentId, scopeFlags },
      );

      this.logLlmPromptContextWhenEnabled(system, user, {
        documentId,
        workspaceId,
        model: this.chatModel,
      });

      this.logger.log(
        `[generateAnswerStream] LLM provider.completeStream: documentId=${documentId} providerId=${provider.id}`,
      );
      let answerText = '';
      for await (const chunk of provider.completeStream(
        [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        {
          model: this.chatModel,
          temperature: 0.3,
          maxTokens: this.maxTokens,
          signal: options?.signal,
        },
      )) {
        answerText += chunk;
        yield { type: 'chunk', content: chunk };
      }
      this.logger.log(
        `[generateAnswerStream] LLM provider.completeStream done: documentId=${documentId} answerLength=${answerText.length}`,
      );

      const notFound = documentChunks.length === 0 && legalChunks.length === 0;
      yield {
        type: 'done',
        answerText,
        confidence,
        citations,
        notFound,
        fromCache: false,
      };

      // Cache key is independent of RAG_TOP_K_* / RAG_SIMILARITY_FLOOR.
      // Tuning changes take effect for cache misses only; existing entries
      // age out via RAG_CACHE_TTL_SECONDS (default 24h). For immediate
      // effect, operators can call ragCacheService.invalidateDocument or
      // flush the rag:cache:* keyspace.
      //
      // Skip caching notFound responses: they're cheap to recompute and
      // caching them creates a poor-UX feedback loop where a one-off bad
      // query poisons the cache.
      if (!notFound) {
        await this.ragCacheService.set(
          documentId,
          jurisdiction,
          questionEmbedding,
          language,
          { answerText, confidence, citations, notFound },
        );
      } else {
        this.logger.log(
          `[generateAnswerStream] Skipping cache write: notFound result documentId=${documentId}`,
        );
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      yield { type: 'error', message: errorMessage };
      this.logRagError('generateAnswerStream', documentId, workspaceId, error);
    }
  }

  /** Call LLM with system and user prompts (via provider adapter). */
  private async callLlm(
    system: string,
    user: string,
    workspaceId?: string,
    options?: { signal?: AbortSignal; documentId?: string },
  ): Promise<string> {
    this.logLlmPromptContextWhenEnabled(system, user, {
      documentId: options?.documentId,
      workspaceId,
      model: this.chatModel,
    });
    const provider = await this.llmProviderRegistry.resolveProvider(workspaceId);
    const messages = [
      { role: 'system' as const, content: system },
      { role: 'user' as const, content: user },
    ];
    return provider.complete(messages, {
      model: this.chatModel,
      temperature: 0.3,
      maxTokens: this.maxTokens,
      signal: options?.signal,
    });
  }

}
