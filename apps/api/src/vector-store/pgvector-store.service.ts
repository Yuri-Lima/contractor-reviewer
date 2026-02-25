import { Injectable } from '@nestjs/common';
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
  constructor(
    @InjectRepository(Chunk)
    private chunkRepository: Repository<Chunk>,
    @InjectRepository(Embedding)
    private embeddingRepository: Repository<Embedding>,
  ) {}

  async searchContractChunks(
    queryEmbedding: number[],
    documentId: string,
    limit: number = 5,
  ): Promise<VectorSearchResult<Chunk>[]> {
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

    const params: unknown[] = [embeddingVector];
    let paramIndex = 2;

    if (filters?.country) {
      query += ` AND ls.country = $${paramIndex}`;
      params.push(filters.country);
      paramIndex++;
    }

    if (filters?.jurisdiction) {
      query += ` AND ls.jurisdiction = $${paramIndex}`;
      params.push(filters.jurisdiction);
      paramIndex++;
    }

    query += ` ORDER BY e.embedding::vector <=> $1::vector LIMIT $${paramIndex}`;
    params.push(limit);

    const results = await this.embeddingRepository.query(query, params);

    return results.map((r: Record<string, unknown>) => {
      const { distance, sourceName, section, country, jurisdiction, url, ...embeddingFields } = r;
      return {
        item: embeddingFields as unknown as Embedding,
        distance: parseFloat(String(distance)),
        sourceName: sourceName as string | undefined,
        section: section as string | undefined,
        country: country as string | undefined,
        jurisdiction: jurisdiction as string | undefined,
        url: url as string | undefined,
      };
    });
  }
}
