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

/**
 * Abstraction over vector store for similarity search.
 * Swap implementations (pgvector, Pinecone, etc.) without changing consumers.
 *
 * Return semantics:
 * - Document search: returns Chunk rows (text, pageNumber, paragraphId) - self-contained for citations
 * - Legal search: returns Embedding rows with denormalized metadata (sourceName, section, country, jurisdiction, url)
 *
 * Consumers fetch document title (relational) separately for document citation fileName.
 */
export interface IVectorStore {
  /** Search document chunks by embedding similarity within a document. Returns chunk rows with text, pageNumber, paragraphId. */
  searchDocumentChunks(
    queryEmbedding: number[],
    documentId: string,
    limit?: number,
  ): Promise<VectorSearchResult<Chunk>[]>;

  /** Search legal embeddings by embedding similarity. Uses denormalized columns (no JOIN). Returns embedding + sourceName, section, country, jurisdiction, url. */
  searchLegalChunks(
    queryEmbedding: number[],
    filters?: LegalChunkFilters,
    limit?: number,
  ): Promise<LegalChunkSearchResult[]>;
}

/** Injection token for IVectorStore */
export const VECTOR_STORE = Symbol('VECTOR_STORE');
