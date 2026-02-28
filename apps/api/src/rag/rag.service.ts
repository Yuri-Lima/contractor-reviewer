import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { OpenAI } from 'openai';
import { Chunk } from '../entities/chunk.entity';
import { Embedding } from '../entities/embedding.entity';
import { Document } from '../entities/document.entity';
import { Citation, ChatResponse } from '@contractai-review/shared';
import { EmbeddingsService } from './embeddings.service';
import { PromptService } from '../prompts/prompt.service';
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
    private configService: ConfigService,
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
    options?: { signal?: AbortSignal },
  ): Promise<RagResponse> {
    try {
      // Generate embedding for the question
      const questionEmbedding = await this.embeddingsService.generateEmbedding(
        question,
        options,
      );

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
      options,
    );

    const notFound = contractChunks.length === 0 && legalChunks.length === 0;

    return {
      answerText,
      confidence,
      citations,
      notFound,
    };
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
        };
      }
      
      // Return a safe error response
      return {
        answerText: `Error generating answer: ${errorMessage}`,
        confidence: 'low',
        citations: [],
        notFound: true,
      };
    }
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

    const languageName = this.promptService.getLanguageName(language);
    const { system, user } = await this.promptService.getChatPrompts(
      {
        languageName,
        context: context || 'No relevant context found.',
        question,
      },
      { workspaceId },
    );

    try {
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
    } catch (error) {
      return `Error generating answer: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
}
