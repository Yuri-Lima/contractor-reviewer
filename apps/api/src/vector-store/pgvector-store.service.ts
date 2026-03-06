import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Chunk } from '../entities/chunk.entity';
import { Embedding } from '../entities/embedding.entity';
import { arrayToVectorString } from '../vector-helpers';
import {
  IVectorStore,
  LegalChunkFilters,
  LegalChunkSearchResult,
  VectorSearchResult,
} from './vector-store.interface';

@Injectable()
export class PgVectorStore implements IVectorStore {
  private readonly logger = new Logger(PgVectorStore.name);

  constructor(
    @InjectRepository(Chunk)
    private chunkRepository: Repository<Chunk>,
    @InjectRepository(Embedding)
    private embeddingRepository: Repository<Embedding>,
  ) {}

  async searchDocumentChunks(
    queryEmbedding: number[],
    documentId: string,
    limit: number = 5,
  ): Promise<VectorSearchResult<Chunk>[]> {
    const start = Date.now();
    const embeddingVector = arrayToVectorString(queryEmbedding);

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

    const queryTimeMs = Date.now() - start;
    this.logger.debug('[VectorSearch] searchDocumentChunks', {
      documentId,
      resultCount: results.length,
      queryTimeMs,
    });

    return results.map((r: Record<string, unknown>) => {
      const { distance, ...chunkFields } = r;
      return {
        item: chunkFields as unknown as Chunk,
        distance: parseFloat(String(distance)),
      };
    });
  }

  async searchLegalChunks(
    queryEmbedding: number[],
    filters?: LegalChunkFilters,
    limit: number = 5,
  ): Promise<LegalChunkSearchResult[]> {
    const embeddingVector = arrayToVectorString(queryEmbedding);

    // Use denormalized columns on embeddings - no JOIN with legal_sources (vector-DB separation ready)
    let query = `
      SELECT 
        e.*,
        1 - (e.embedding::vector <=> $1::vector) AS distance
      FROM embeddings e
      WHERE e.embedding IS NOT NULL
    `;

    const params: unknown[] = [embeddingVector];
    let paramIndex = 2;

    if (filters?.country) {
      query += ` AND e.country = $${paramIndex}`;
      params.push(filters.country);
      paramIndex++;
    }

    if (filters?.jurisdiction) {
      query += ` AND e.jurisdiction = $${paramIndex}`;
      params.push(filters.jurisdiction);
      paramIndex++;
    }

    query += ` ORDER BY e.embedding::vector <=> $1::vector LIMIT $${paramIndex}`;
    params.push(limit);

    const start = Date.now();
    const results = await this.embeddingRepository.query(query, params);
    const queryTimeMs = Date.now() - start;
    this.logger.debug('[VectorSearch] searchLegalChunks', {
      resultCount: results.length,
      queryTimeMs,
      jurisdiction: filters?.jurisdiction,
    });

    return results.map((r: Record<string, unknown>) => {
      const { distance, ...embeddingFields } = r;
      const item = embeddingFields as unknown as Embedding;
      return {
        item,
        distance: parseFloat(String(distance)),
        sourceName: item.sourceName ?? undefined,
        section: item.section ?? undefined,
        country: item.country ?? undefined,
        jurisdiction: item.jurisdiction ?? undefined,
        url: item.url ?? undefined,
      };
    });
  }
}
