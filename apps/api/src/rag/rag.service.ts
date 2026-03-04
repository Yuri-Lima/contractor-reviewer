import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { OpenAI } from 'openai';
import { Chunk } from '../entities/chunk.entity';
import { Embedding } from '../entities/embedding.entity';
import { Document } from '../entities/document.entity';
import {
  ChatPreparePayload,
  ChatPrepareResponse,
  Citation,
  ChatResponse,
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

// Re-export for backward compatibility
export type { Citation };
export type RagResponse = ChatResponse;

@Injectable()
export class RagService {
  private readonly openaiClient: OpenAI;
  private readonly chatModel: string;

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
  ) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      console.warn('OPENAI_API_KEY not set - chat answers will fail');
    }
    this.openaiClient = new OpenAI({ apiKey: apiKey || 'dummy-key' });
    this.chatModel = this.configService.get<string>('OPENAI_CHAT_MODEL') || 'gpt-4o-mini';
  }

  /**
   * Search for similar chunks using vector similarity
   */
  async searchContractChunks(
    queryEmbedding: number[],
    documentId: string,
    limit: number = 5,
  ): Promise<VectorSearchResult<Chunk>[]> {
    return this.vectorStore.searchContractChunks(queryEmbedding, documentId, limit);
  }

  /**
   * Search for similar legal source chunks
   */
  async searchLegalChunks(
    queryEmbedding: number[],
    country?: string,
    jurisdiction?: string,
    limit: number = 5,
  ): Promise<LegalChunkSearchResult[]> {
    return this.vectorStore.searchLegalChunks(
      queryEmbedding,
      { country, jurisdiction },
      limit,
    );
  }

  /**
   * Generate answer using RAG with citations
   */
  async generateAnswer(
    question: string,
    documentId: string,
    workspaceId: string,
    jurisdiction?: string,
    language: string = 'en',
    options?: { signal?: AbortSignal; forceFresh?: boolean; similarityThreshold?: number },
  ): Promise<RagResponse> {
    try {
      // Generate embedding for the question
      const questionEmbedding = await this.embeddingsService.generateEmbedding(
        question,
        options,
      );

      // Check semantic cache (unless forceFresh)
      if (!options?.forceFresh) {
        const cached = await this.ragCacheService.get(
          documentId,
          jurisdiction,
          questionEmbedding,
          language,
          { similarityThreshold: options?.similarityThreshold },
        );
        if (cached) {
          return { ...cached, fromCache: true };
        }
      }

      // Search contract chunks
      const contractChunks = await this.searchContractChunks(
        questionEmbedding,
        documentId,
        5,
      );

    // Search legal chunks (if jurisdiction available)
    const legalChunks = jurisdiction
      ? await this.searchLegalChunks(questionEmbedding, undefined, jurisdiction, 3)
      : [];

    // Determine confidence based on results
    // Note: distance here is similarity (1 - cosine_distance), so higher = more similar
    // Cosine distance: 0 = identical, 1 = completely different
    // Similarity: 1 - distance, so 1 = identical, 0 = completely different
    const hasGoodMatches =
      contractChunks.length > 0 && contractChunks[0].distance > 0.7;
    const hasLegalMatches = legalChunks.length > 0 && legalChunks[0].distance > 0.7;
    
    // Also check if we have any matches at all (even with lower similarity)
    const hasAnyMatches = contractChunks.length > 0 || legalChunks.length > 0;
    const hasMediumMatches = 
      (contractChunks.length > 0 && contractChunks[0].distance > 0.5) ||
      (legalChunks.length > 0 && legalChunks[0].distance > 0.5);
    
    // If we have multiple chunks, even with lower similarity, it's still relevant
    const hasMultipleChunks = contractChunks.length >= 2;

    let confidence: 'high' | 'medium' | 'low' = 'low';
    if (hasGoodMatches && hasLegalMatches) {
      confidence = 'high';
    } else if (hasGoodMatches || hasLegalMatches) {
      confidence = 'high';
    } else if (hasMediumMatches || hasMultipleChunks) {
      confidence = 'medium'; // Multiple chunks or decent similarity = medium confidence
    } else if (hasAnyMatches) {
      confidence = 'low'; // At least we found something
    }

    // Build citations
    const citations: Citation[] = [];

    // Contract citations
    const document = await this.documentRepository.findOne({
      where: { id: documentId },
    });

    // Add citations for top chunks (even if similarity is lower, they're still relevant)
    for (const result of contractChunks.slice(0, 3)) {
      // Lower threshold to include more citations (0.4 instead of 0.6)
      // Since distance is similarity, lower values still mean some relevance
      if (result.distance > 0.4 || contractChunks.length <= 3) {
        citations.push({
          type: 'contract',
          fileName: document?.title || 'Document',
          pageNumber: result.item.pageNumber || undefined,
          paragraphId: result.item.paragraphId || undefined,
          quoteSnippet: result.item.text.substring(0, 200) + '...',
        });
      }
    }

    // Legal citations
    for (const result of legalChunks.slice(0, 2)) {
      // Lower threshold for legal citations too
      if (result.distance > 0.4 || legalChunks.length <= 2) {
        citations.push({
          type: 'legal',
          sourceName: result.sourceName || 'Legal Source',
          section: result.item.section || result.section || undefined,
          url: result.url || undefined,
          quoteSnippet: result.item.text.substring(0, 200) + '...',
        });
      }
    }

    // Generate answer using OpenAI
    const answerText = await this.generateAnswerText(
      question,
      contractChunks,
      legalChunks,
      language,
      workspaceId,
      documentId,
      options,
    );

    const notFound = contractChunks.length === 0 && legalChunks.length === 0;

    const response: RagResponse = {
      answerText,
      confidence,
      citations,
      notFound,
    };

    // Store in cache for future similar queries
    await this.ragCacheService.set(
      documentId,
      jurisdiction,
      questionEmbedding,
      language,
      response,
    );

    return { ...response, fromCache: false };
    } catch (error) {
      // Never log question content or answer text
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('RAG generateAnswer error (documentId, workspaceId):', documentId, workspaceId, errorMessage);
      
      // Check if it's an embedding/quota error
      if (errorMessage.includes('quota') || errorMessage.includes('429')) {
        return {
          answerText: 'Unable to generate answer: OpenAI API quota exceeded. Please check your API key and billing.',
          confidence: 'low',
          citations: [],
          notFound: true,
          fromCache: false,
        };
      }
      
      // Return a safe error response
      return {
        answerText: `Error generating answer: ${errorMessage}`,
        confidence: 'low',
        citations: [],
        notFound: true,
        fromCache: false,
      };
    }
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

    const contractChunks = await this.searchContractChunks(
      questionEmbedding,
      documentId,
      5,
    );

    const legalChunks = jurisdiction
      ? await this.searchLegalChunks(questionEmbedding, undefined, jurisdiction, 3)
      : [];

    const contractContext = contractChunks
      .map((c, i) => `[Contract Excerpt ${i + 1}]: ${c.item.text}`)
      .join('\n\n');
    const legalContext = legalChunks
      .map((c, i) => `[Legal Source ${i + 1}]: ${c.item.text}`)
      .join('\n\n');
    const context = [contractContext, legalContext].filter(Boolean).join('\n\n');

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
      contractChunks: contractChunks.map((c) => ({
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
      maxTokens: 500,
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
      throw new BadRequestException(
        'Preparation expired or invalid. Please submit your question again.',
      );
    }

    const answerText = await this.callOpenAI(
      payload.systemPrompt,
      payload.userPrompt,
      options,
    );

    const contractChunks = payload.contractChunks;
    const legalChunks = payload.legalChunks;
    const hasGoodMatches =
      contractChunks.length > 0 && contractChunks[0].similarity > 0.7;
    const hasLegalMatches =
      legalChunks.length > 0 && legalChunks[0].similarity > 0.7;
    const hasAnyMatches = contractChunks.length > 0 || legalChunks.length > 0;
    const hasMediumMatches =
      (contractChunks.length > 0 && contractChunks[0].similarity > 0.5) ||
      (legalChunks.length > 0 && legalChunks[0].similarity > 0.5);
    const hasMultipleChunks = contractChunks.length >= 2;

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

    for (const result of contractChunks.slice(0, 3)) {
      if (result.similarity > 0.4 || contractChunks.length <= 3) {
        citations.push({
          type: 'contract',
          fileName: document?.title || 'Document',
          pageNumber: result.pageNumber,
          paragraphId: result.paragraphId,
          quoteSnippet: result.text.substring(0, 200) + '...',
        });
      }
    }

    for (const result of legalChunks.slice(0, 2)) {
      if (result.similarity > 0.4 || legalChunks.length <= 2) {
        citations.push({
          type: 'legal',
          sourceName: result.sourceName || 'Legal Source',
          section: result.section,
          url: result.url,
          quoteSnippet: result.text.substring(0, 200) + '...',
        });
      }
    }

    return {
      response: {
        answerText,
        confidence,
        citations,
        notFound: contractChunks.length === 0 && legalChunks.length === 0,
        fromCache: false,
      },
      question: payload.question,
    };
  }

  /** Call OpenAI with system and user prompts (extracted for reuse). */
  private async callOpenAI(
    system: string,
    user: string,
    options?: { signal?: AbortSignal },
  ): Promise<string> {
    const response = await this.openaiClient.chat.completions.create(
      {
        model: this.chatModel,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: 0.3,
        max_tokens: 500,
      },
      { signal: options?.signal },
    );
    return response.choices[0].message.content || 'NOT FOUND';
  }

  /**
   * Generate answer text using OpenAI with context
   */
  private async generateAnswerText(
    question: string,
    contractChunks: VectorSearchResult<Chunk>[],
    legalChunks: LegalChunkSearchResult[],
    language: string = 'en',
    workspaceId?: string,
    documentId?: string,
    options?: { signal?: AbortSignal },
  ): Promise<string> {
    // Build context from chunks
    const contractContext = contractChunks
      .map((c, i) => `[Contract Excerpt ${i + 1}]: ${c.item.text}`)
      .join('\n\n');

    const legalContext = legalChunks
      .map((c, i) => `[Legal Source ${i + 1}]: ${c.item.text}`)
      .join('\n\n');

    const context = [contractContext, legalContext].filter(Boolean).join('\n\n');

    const [workspaceSettings, document] = await Promise.all([
      workspaceId ? this.workspaceSettingsService.getSettings(workspaceId) : Promise.resolve(null),
      documentId ? this.documentRepository.findOne({ where: { id: documentId } }) : Promise.resolve(null),
    ]);

    const scopeFlags =
      workspaceId && documentId && (workspaceSettings || document)
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

    try {
      return await this.callOpenAI(system, user, options);
    } catch (error) {
      return `Error generating answer: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
}
