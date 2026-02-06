import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { OpenAI } from 'openai';
import { Chunk } from '../entities/chunk.entity';
import { Embedding } from '../entities/embedding.entity';
import { Document } from '../entities/document.entity';
import { EmbeddingsService } from './embeddings.service';
import { arrayToVectorString } from '../vector-helpers';

export interface Citation {
  type: 'contract' | 'legal';
  fileName?: string;
  pageNumber?: number;
  paragraphId?: string;
  quoteSnippet: string;
  sourceName?: string;
  section?: string;
  url?: string;
}

export interface RagResponse {
  answerText: string;
  confidence: 'high' | 'medium' | 'low';
  citations: Citation[];
  notFound: boolean;
}

@Injectable()
export class RagService {
  private readonly openaiClient: OpenAI;

  constructor(
    @InjectRepository(Chunk)
    private chunkRepository: Repository<Chunk>,
    @InjectRepository(Embedding)
    private embeddingRepository: Repository<Embedding>,
    @InjectRepository(Document)
    private documentRepository: Repository<Document>,
    private embeddingsService: EmbeddingsService,
    private configService: ConfigService,
  ) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      console.warn('OPENAI_API_KEY not set - chat answers will fail');
    }
    this.openaiClient = new OpenAI({ apiKey: apiKey || 'dummy-key' });
  }

  /**
   * Search for similar chunks using vector similarity
   */
  async searchContractChunks(
    queryEmbedding: number[],
    documentId: string,
    limit: number = 5,
  ): Promise<Array<Chunk & { distance: number }>> {
    const embeddingVector = arrayToVectorString(queryEmbedding);

    // Use cosine distance for similarity search
    // Cast embedding column to vector type for pgvector operations
    const results = await this.chunkRepository.query(
      `
      SELECT 
        c.*,
        1 - (c.embedding::vector <=> $1::vector) AS distance
      FROM chunks c
      WHERE c."documentId" = $2
        AND c.embedding IS NOT NULL
      ORDER BY c.embedding::vector <=> $1::vector
      LIMIT $3
    `,
      [embeddingVector, documentId, limit],
    );

    return results.map((r: any) => ({
      ...r,
      distance: parseFloat(r.distance),
    }));
  }

  /**
   * Search for similar legal source chunks
   */
  async searchLegalChunks(
    queryEmbedding: number[],
    country?: string,
    jurisdiction?: string,
    limit: number = 5,
  ): Promise<Array<Embedding & { distance: number; sourceName?: string; section?: string; country?: string; jurisdiction?: string; url?: string }>> {
    const embeddingVector = arrayToVectorString(queryEmbedding);

    let query = `
      SELECT 
        e.*,
        ls."sourceName",
        ls."section",
        ls."country",
        ls."jurisdiction",
        ls."url",
        1 - (e.embedding::vector <=> $1::vector) AS distance
      FROM embeddings e
      LEFT JOIN legal_sources ls ON e."legalSourceId" = ls.id
      WHERE e.embedding IS NOT NULL
    `;

    const params: any[] = [embeddingVector];
    let paramIndex = 2;

    if (country) {
      query += ` AND ls.country = $${paramIndex}`;
      params.push(country);
      paramIndex++;
    }

    if (jurisdiction) {
      query += ` AND ls.jurisdiction = $${paramIndex}`;
      params.push(jurisdiction);
      paramIndex++;
    }

    query += ` ORDER BY e.embedding::vector <=> $1::vector LIMIT $${paramIndex}`;
    params.push(limit);

    const results = await this.embeddingRepository.query(query, params);

    return results.map((r: any) => ({
      ...r,
      distance: parseFloat(r.distance),
    }));
  }

  /**
   * Generate answer using RAG with citations
   */
  async generateAnswer(
    question: string,
    documentId: string,
    workspaceId: string,
    jurisdiction?: string,
  ): Promise<RagResponse> {
    try {
      // Generate embedding for the question
      const questionEmbedding = await this.embeddingsService.generateEmbedding(question);

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
    for (const chunk of contractChunks.slice(0, 3)) {
      // Lower threshold to include more citations (0.4 instead of 0.6)
      // Since distance is similarity, lower values still mean some relevance
      if (chunk.distance > 0.4 || contractChunks.length <= 3) {
        citations.push({
          type: 'contract',
          fileName: document?.title || 'Document',
          pageNumber: chunk.pageNumber || undefined,
          paragraphId: chunk.paragraphId || undefined,
          quoteSnippet: chunk.text.substring(0, 200) + '...',
        });
      }
    }

    // Legal citations
    for (const chunk of legalChunks.slice(0, 2)) {
      // Lower threshold for legal citations too
      if (chunk.distance > 0.4 || legalChunks.length <= 2) {
        citations.push({
          type: 'legal',
          sourceName: (chunk as any).sourceName || 'Legal Source',
          section: chunk.section || undefined,
          url: (chunk as any).url || undefined,
          quoteSnippet: chunk.text.substring(0, 200) + '...',
        });
      }
    }

    // Generate answer using OpenAI
    const answerText = await this.generateAnswerText(
      question,
      contractChunks,
      legalChunks,
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
    contractChunks: Array<Chunk & { distance: number }>,
    legalChunks: Array<Embedding & { distance: number; sourceName?: string }>,
  ): Promise<string> {
    // Build context from chunks
    const contractContext = contractChunks
      .map((c, i) => `[Contract Excerpt ${i + 1}]: ${c.text}`)
      .join('\n\n');

    const legalContext = legalChunks
      .map((c, i) => `[Legal Source ${i + 1}]: ${c.text}`)
      .join('\n\n');

    const context = [contractContext, legalContext].filter(Boolean).join('\n\n');

    const prompt = `You are a legal assistant analyzing contracts. Answer the question based ONLY on the provided context. If the context doesn't contain enough information, say "NOT FOUND" and suggest where to look.

Context:
${context || 'No relevant context found.'}

Question: ${question}

Answer (be concise and cite specific excerpts):`;

    try {
      const response = await this.openaiClient.chat.completions.create({
        model: 'gpt-4o-mini', // or gpt-4o for better quality
        messages: [
          {
            role: 'system',
            content:
              'You are a legal assistant. Provide accurate, evidence-based answers. Always cite your sources.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3, // Lower temperature for more factual responses
        max_tokens: 500,
      });

      return response.choices[0].message.content || 'NOT FOUND';
    } catch (error) {
      return `Error generating answer: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
}
