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
  type LegalAnswer,
  type LegalIssue,
  type StreamEvent,
} from '@contractai-review/shared';
import { EmbeddingsService } from './embeddings.service';
import { PromptService, LEGAL_REVIEW_PROMPT_VARIANT } from '../prompts/prompt.service';
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
import { LegalReviewModelResolver } from './legal-review-model-resolver.service';
import {
  LEGAL_ANSWER_JSON_SCHEMA,
  LEGAL_ANSWER_SCHEMA_NAME,
  LegalAnswerZ,
  normaliseLegalAnswer,
} from './legal-answer.schema';
import { completeStructuredWithRetry } from './structured-output.helper';

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
    private legalReviewModelResolver: LegalReviewModelResolver,
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

    const documentContext = this.formatDocumentContext(documentChunks);
    const legalContext = this.formatLegalContext(legalChunks);

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

    const legalReviewMode = await this.resolveLegalReviewMode(workspaceId);
    const variant = legalReviewMode ? LEGAL_REVIEW_PROMPT_VARIANT : 'default';

    // Legal-review variant has separate {{context}} and {{legalSources}} slots.
    const combinedContext =
      [documentContext, !legalReviewMode && legalContext ? legalContext : ''].filter(Boolean).join('\n\n') ||
      'No relevant context found.';

    const languageName = this.promptService.getLanguageName(language);
    const { system, user } = await this.promptService.getChatPrompts(
      {
        languageName,
        context: combinedContext,
        question,
        jurisdiction,
        legalSources: legalContext || 'No statutes available for this jurisdiction.',
      },
      { workspaceId, documentId, scopeFlags, variant },
    );

    // Resolve model: in legal-review mode, prefer LEGAL_REVIEW_MODEL_<PROVIDER>
    // (returns null = adapter default). Otherwise the legacy chatModel.
    let resolvedModel: string | null = this.chatModel;
    if (legalReviewMode) {
      const provider = await this.llmProviderRegistry.resolveProvider(workspaceId);
      resolvedModel = this.legalReviewModelResolver.resolve(provider) ?? null;
    }

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
      model: resolvedModel,
      temperature: legalReviewMode ? 0 : 0.3,
      maxTokens: this.maxTokens,
      legalReviewMode,
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

    const documentChunks = payload.documentChunks;
    const legalChunks = payload.legalChunks;

    const legalAnswer = await this.callLlmStructured(
      payload.systemPrompt,
      payload.userPrompt,
      workspaceId,
      { ...options, documentId, modelOverride: payload.model },
    );
    const answerText = this.summariseLegalAnswer(legalAnswer);
    const structuredConfidence: 'high' | 'medium' | 'low' = this.confidenceFromAnswer(legalAnswer);

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
    if (structuredConfidence) {
      confidence = structuredConfidence;
    } else if (hasGoodMatches && hasLegalMatches) {
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
        ...(legalAnswer ? { legalAnswer } : {}),
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
            `[generateAnswerStream] Cache hit: documentId=${documentId} answerLength=${cached.answerText?.length ?? 0} hasLegalAnswer=${Boolean(cached.legalAnswer)}`,
          );
          if (cached.legalAnswer) {
            // Structured cache hit — replay the structured event before `done`.
            yield { type: 'legal-answer', answer: cached.legalAnswer };
          } else {
            yield { type: 'chunk', content: cached.answerText };
          }
          yield {
            type: 'done',
            answerText: cached.answerText,
            ...(cached.legalAnswer ? { legalAnswer: cached.legalAnswer } : {}),
            confidence: cached.confidence,
            citations: cached.citations ?? [],
            notFound: cached.notFound ?? false,
            fromCache: true,
          };
          return;
        }
      }

      const legalReviewMode = await this.resolveLegalReviewMode(workspaceId);
      const variant = legalReviewMode ? LEGAL_REVIEW_PROMPT_VARIANT : 'default';
      this.logger.log(
        `[generateAnswerStream] mode resolved: documentId=${documentId} legalReviewMode=${legalReviewMode} variant=${variant}`,
      );

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
      // Phase 3 rerank: nudge legal chunks whose `actName` appears verbatim in
      // any retrieved document chunk so the LLM sees the most-relevant statute
      // first. Bonus is +0.1 (cap at 1.0) and applied before the similarity
      // floor — keeps the quote-match signal but doesn't bypass the floor.
      const legalChunksReranked = this.rerankLegalByActMention(
        rawLegalChunks,
        rawDocumentChunks.map((c) => c.item.text),
      );
      const legalChunks = this.applySimilarityFloor(legalChunksReranked);
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
          const clauseNumber = (result.item as { clauseNumber?: string | null }).clauseNumber ?? undefined;
          citations.push({
            type: 'document',
            fileName: doc?.title,
            pageNumber: result.item.pageNumber,
            paragraphId: result.item.paragraphId,
            ...(clauseNumber ? { clauseNumber } : {}),
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

      const documentContextStr = this.formatDocumentContext(documentChunks);
      const legalContextStr = this.formatLegalContext(legalChunks);

      // Legal-review variant uses a separate {{legalSources}} slot; otherwise
      // we keep the legacy concatenated context for backward compatibility.
      let context =
        (legalReviewMode
          ? documentContextStr
          : [documentContextStr, legalContextStr].filter(Boolean).join('\n\n')) ||
        'No relevant context found.';

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
        `[generateAnswerStream] Build system + user prompts: documentId=${documentId} workspaceId=${workspaceId} variant=${variant}`,
      );
      const { system, user } = await this.promptService.getChatPrompts(
        {
          languageName: this.promptService.getLanguageName(language),
          context,
          question,
          conversationHistory: options?.conversationHistory,
          jurisdiction,
          legalSources: legalContextStr || 'No statutes available for this jurisdiction.',
        },
        { workspaceId, documentId, scopeFlags, variant },
      );

      let answerText = '';
      let legalAnswer: LegalAnswer | undefined;
      let finalConfidence: 'high' | 'medium' | 'low' = confidence;

      if (legalReviewMode) {
        // Structured-output path: a single `legal-answer` event, then `done`.
        // OpenAI/Anthropic structured-output APIs don't safely stream partial JSON.
        const overrideModel = this.legalReviewModelResolver.resolve(provider) ?? null;
        legalAnswer = await this.callLlmStructured(system, user, workspaceId, {
          signal: options?.signal,
          documentId,
          modelOverride: overrideModel,
        });
        answerText = this.summariseLegalAnswer(legalAnswer);
        finalConfidence = this.confidenceFromAnswer(legalAnswer);
        yield { type: 'legal-answer', answer: legalAnswer };
      } else {
        this.logLlmPromptContextWhenEnabled(system, user, {
          documentId,
          workspaceId,
          model: this.chatModel,
        });
        this.logger.log(
          `[generateAnswerStream] LLM provider.completeStream: documentId=${documentId} providerId=${provider.id}`,
        );
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
      }
      this.logger.log(
        `[generateAnswerStream] LLM call done: documentId=${documentId} answerLength=${answerText.length} hasLegalAnswer=${Boolean(legalAnswer)}`,
      );

      const notFound = documentChunks.length === 0 && legalChunks.length === 0;
      yield {
        type: 'done',
        answerText,
        ...(legalAnswer ? { legalAnswer } : {}),
        confidence: finalConfidence,
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
          {
            answerText,
            ...(legalAnswer ? { legalAnswer } : {}),
            confidence: finalConfidence,
            citations,
            notFound,
          },
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

  /**
   * Resolve whether the legal-review structured-output path is active for a
   * workspace. Per-workspace `legalReviewMode` setting wins; if unset, the
   * server-wide `LEGAL_REVIEW_MODE=on` env var is the default.
   */
  private async resolveLegalReviewMode(workspaceId: string): Promise<boolean> {
    const settings = await this.workspaceSettingsService
      .getSettings(workspaceId)
      .catch(() => null);
    const wsFlag = settings?.legalReviewMode;
    if (typeof wsFlag === 'boolean') return wsFlag;
    const envFlag = (this.configService.get<string>('LEGAL_REVIEW_MODE') ?? '').toLowerCase();
    return envFlag === 'on' || envFlag === 'true' || envFlag === '1';
  }

  /**
   * Format document chunks with clause numbers when available (Phase 2 of
   * legal-review pipeline). Falls back to "[Excerpt N]" when the chunk lacks
   * heading metadata.
   */
  private formatDocumentContext<
    C extends { item: { text: string; pageNumber?: number | null; clauseNumber?: string | null } },
  >(documentChunks: C[]): string {
    return documentChunks
      .map((c, i) => {
        const ref = c.item.clauseNumber
          ? `Clause ${c.item.clauseNumber}`
          : `Excerpt ${i + 1}`;
        const page = c.item.pageNumber ? ` — page ${c.item.pageNumber}` : '';
        return `[${ref}${page}]: ${c.item.text}`;
      })
      .join('\n\n');
  }

  /**
   * Phase 3 reranker: when a document chunk mentions a candidate legal
   * source's `actName` verbatim, bump that source's similarity score by
   * `LEGAL_RERANK_BONUS` (capped at 1.0) and re-sort. This addresses the
   * common failure mode where the user asks "is this pension clause
   * compliant?" and the relevant statute is buried below an off-topic but
   * lexically-similar one.
   *
   * Heuristic: case-insensitive substring match on the act's short name only.
   * False positives (a doc that mentions "Pensions Act" without meaning the
   * 1990 act) are bounded — at worst we promote one statute that was already
   * a candidate; we don't invent results.
   */
  private rerankLegalByActMention(
    legalChunks: Array<LegalChunkSearchResult>,
    documentTexts: string[],
  ): Array<LegalChunkSearchResult> {
    if (legalChunks.length === 0 || documentTexts.length === 0) {
      return legalChunks;
    }
    const corpus = documentTexts.join(' \n ').toLowerCase();
    const BONUS = 0.1;
    const updated = legalChunks.map((chunk) => {
      const actName =
        chunk.actName ??
        (chunk.item as { actName?: string | null }).actName ??
        undefined;
      if (!actName || actName.length < 4) return chunk;
      if (corpus.includes(actName.toLowerCase())) {
        return {
          ...chunk,
          distance: Math.min(1, chunk.distance + BONUS),
        };
      }
      return chunk;
    });
    updated.sort((a, b) => b.distance - a.distance);
    return updated;
  }

  /** Format legal-source chunks for the "Legal sources" block of the user prompt. */
  private formatLegalContext(
    legalChunks: Array<LegalChunkSearchResult>,
  ): string {
    return legalChunks
      .map((c, i) => {
        const actName = c.sourceName || (c.item as { actName?: string }).actName || 'Unknown source';
        const actYear =
          (c.item as { actYear?: number | null }).actYear ??
          undefined;
        const section = c.section || c.item.section || '';
        const header = [
          `Legal Source ${i + 1}`,
          actName + (actYear ? ` ${actYear}` : ''),
          section,
        ]
          .filter(Boolean)
          .join(': ');
        return `[${header}]: ${c.item.text}`;
      })
      .join('\n\n');
  }

  /**
   * Build a one-line human summary from a `LegalAnswer` for legacy renderers
   * that only know about `answerText`. Prefers `freeText`; otherwise summarises
   * the issue counts.
   */
  private summariseLegalAnswer(answer: LegalAnswer): string {
    if (answer.freeText && answer.freeText.trim().length > 0) {
      return answer.freeText.trim();
    }
    const issueCount = answer.issues.length;
    const blockerCount = answer.issues.filter((i) => i.severity === 'blocker').length;
    const highCount = answer.issues.filter((i) => i.severity === 'high').length;
    const compliantCount = answer.compliantElements.length;
    const parts = [
      `${compliantCount} compliant element${compliantCount === 1 ? '' : 's'}`,
      `${issueCount} issue${issueCount === 1 ? '' : 's'} (${blockerCount} blocker, ${highCount} high)`,
      `confidence ${answer.confidence}`,
    ];
    return parts.join(', ');
  }

  /**
   * Build a graceful-degradation `LegalAnswer` for the case where structured
   * output failed validation twice in a row. Surfaces the raw model output in
   * `freeText` so the UI still shows something useful.
   */
  private degradedLegalAnswer(raw: string, validationErrors?: string[]): LegalAnswer {
    const detail = validationErrors && validationErrors.length > 0
      ? ` Validation: ${validationErrors.slice(0, 2).join('; ')}`
      : '';
    const issue: LegalIssue = {
      severity: 'info',
      category: 'compliance',
      message: `Model failed to produce structured output (after 1 retry).${detail}`,
    };
    return {
      compliantElements: [],
      issues: [issue],
      recommendations: [],
      legislationReferenced: [],
      confidence: 'low',
      freeText: raw && raw.length > 0 ? raw.substring(0, 1500) : 'No model output.',
    };
  }

  /**
   * Issue a structured `LegalAnswer` call against the resolved provider, with
   * one retry. Returns a degraded answer on persistent failure.
   */
  private async callLlmStructured(
    system: string,
    user: string,
    workspaceId: string,
    options?: { signal?: AbortSignal; documentId?: string; modelOverride?: string | null },
  ): Promise<LegalAnswer> {
    const provider = await this.llmProviderRegistry.resolveProvider(workspaceId);
    const resolvedModel =
      options?.modelOverride ?? this.legalReviewModelResolver.resolve(provider);

    this.logLlmPromptContextWhenEnabled(system, user, {
      documentId: options?.documentId,
      workspaceId,
      model: resolvedModel ?? `${provider.id}:default`,
    });

    const result = await completeStructuredWithRetry(
      provider,
      [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      {
        name: LEGAL_ANSWER_SCHEMA_NAME,
        jsonSchema: LEGAL_ANSWER_JSON_SCHEMA,
        description:
          'Structured legal-grade answer with clause-numbered citations, named statutes, and severity-tagged issues.',
      },
      LegalAnswerZ,
      {
        ...(resolvedModel ? { model: resolvedModel } : {}),
        temperature: 0,
        maxTokens: this.maxTokens,
        signal: options?.signal,
      },
    );

    if (!result.success || !result.data) {
      this.logger.warn(
        `[callLlmStructured] graceful degradation. provider=${provider.id} model=${resolvedModel ?? 'default'} attempts=${result.attempts} errors=${JSON.stringify(result.validationErrors ?? [])}`,
      );
      return this.degradedLegalAnswer(result.raw, result.validationErrors);
    }
    return normaliseLegalAnswer(result.data);
  }

  /**
   * Map the structured `LegalAnswer.confidence` enum to the existing
   * `ChatResponse.confidence` enum (same ladder, 1:1).
   */
  private confidenceFromAnswer(answer: LegalAnswer): 'high' | 'medium' | 'low' {
    return answer.confidence;
  }

  /** Call LLM with system and user prompts (via provider adapter). */
  private async callLlm(
    system: string,
    user: string,
    workspaceId?: string,
    options?: { signal?: AbortSignal; documentId?: string; modelOverride?: string | null },
  ): Promise<string> {
    const provider = await this.llmProviderRegistry.resolveProvider(workspaceId);
    // If modelOverride is null (legal-mode payload with no env override), let the adapter
    // use its own defaultModel — never fall back to this.chatModel for non-OpenAI providers.
    const model =
      options?.modelOverride === null
        ? undefined
        : options?.modelOverride ?? this.chatModel;
    this.logLlmPromptContextWhenEnabled(system, user, {
      documentId: options?.documentId,
      workspaceId,
      model: model ?? `${provider.id}:default`,
    });
    const messages = [
      { role: 'system' as const, content: system },
      { role: 'user' as const, content: user },
    ];
    return provider.complete(messages, {
      ...(model ? { model } : {}),
      temperature: 0.3,
      maxTokens: this.maxTokens,
      signal: options?.signal,
    });
  }
}
