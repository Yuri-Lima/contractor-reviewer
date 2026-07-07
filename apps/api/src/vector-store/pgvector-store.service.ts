import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Chunk } from '../entities/chunk.entity';
import { Embedding } from '../entities/embedding.entity';
import { arrayToVectorString } from '../vector-helpers';
import {
  DocumentChunkStats,
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
    embeddingModel?: string,
  ): Promise<VectorSearchResult<Chunk>[]> {
    const start = Date.now();
    const embeddingVector = arrayToVectorString(queryEmbedding);

    // Filter by embeddingModel when provided so mixed-model vectors never
    // participate in cosine ranking (silent recall degradation bug).
    const params: unknown[] = [embeddingVector, documentId];
    let modelClause = '';
    if (embeddingModel) {
      params.push(embeddingModel);
      modelClause = ` AND c."embeddingModel" = $3`;
      params.push(limit);
    } else {
      params.push(limit);
    }
    const limitParam = embeddingModel ? '$4' : '$3';

    const results = await this.chunkRepository.query(
      `
      SELECT 
        c.*,
        1 - (c.embedding::vector <=> $1::vector) AS distance
      FROM chunks c
      WHERE c."documentId" = $2
        AND c.embedding IS NOT NULL
        ${modelClause}
      ORDER BY c.embedding::vector <=> $1::vector
      LIMIT ${limitParam}
    `,
      params,
    );

    const queryTimeMs = Date.now() - start;
    this.logger.debug('[VectorSearch] searchDocumentChunks', {
      documentId,
      resultCount: results.length,
      queryTimeMs,
      embeddingModel,
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

    if (filters?.actName) {
      query += ` AND e."actName" = $${paramIndex}`;
      params.push(filters.actName);
      paramIndex++;
    }

    if (filters?.embeddingModel) {
      query += ` AND e."embeddingModel" = $${paramIndex}`;
      params.push(filters.embeddingModel);
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
      embeddingModel: filters?.embeddingModel,
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
        actName: (item as { actName?: string | null }).actName ?? undefined,
        actYear: (item as { actYear?: number | null }).actYear ?? undefined,
      };
    });
  }

  async getDocumentChunkStats(documentId: string): Promise<DocumentChunkStats> {
    // Single round-trip aggregate: COUNT(*) for total, COUNT(embedding) for
    // embedded (NULLs are excluded by COUNT(col)). Avoids a follow-up query.
    const rows = await this.chunkRepository.query(
      `
      SELECT
        COUNT(*)::int AS total,
        COUNT(c.embedding)::int AS embedded
      FROM chunks c
      WHERE c."documentId" = $1
    `,
      [documentId],
    );
    const row = (rows?.[0] ?? { total: 0, embedded: 0 }) as DocumentChunkStats;
    return {
      total: typeof row.total === 'number' ? row.total : parseInt(String(row.total), 10) || 0,
      embedded:
        typeof row.embedded === 'number'
          ? row.embedded
          : parseInt(String(row.embedded), 10) || 0,
    };
  }
}
