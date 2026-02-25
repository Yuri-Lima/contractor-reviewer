import { Chunk } from '../entities/chunk.entity';
import { Embedding } from '../entities/embedding.entity';

/** Result of a vector similarity search */
export interface VectorSearchResult<T> {
  item: T;
  distance: number; // similarity (1 - cosine_distance) or score
}

/** Legal chunk search result with legal source metadata */
export interface LegalChunkSearchResult
  extends VectorSearchResult<Embedding> {
  sourceName?: string;
  section?: string;
  country?: string;
  jurisdiction?: string;
  url?: string;
}

/** Filters for legal chunk search */
export interface LegalChunkFilters {
  country?: string;
  jurisdiction?: string;
}

/** Abstraction over vector store for similarity search. Swap implementations (pgvector, Pinecone, etc.) without changing consumers. */
export interface IVectorStore {
  /** Search contract chunks by embedding similarity within a document */
  searchContractChunks(
    queryEmbedding: number[],
    documentId: string,
    limit?: number,
  ): Promise<VectorSearchResult<Chunk>[]>;

  /** Search legal embeddings by embedding similarity with optional filters */
  searchLegalChunks(
    queryEmbedding: number[],
    filters?: LegalChunkFilters,
    limit?: number,
  ): Promise<LegalChunkSearchResult[]>;
}

/** Injection token for IVectorStore */
export const VECTOR_STORE = Symbol('VECTOR_STORE');
