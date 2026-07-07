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
  /** Canonical short name of the act, denormalized from the corpus YAML. */
  actName?: string;
  /** Year of the act (e.g. 1990 for "Pensions Act 1990"). */
  actYear?: number;
}

/** Filters for legal chunk search */
export interface LegalChunkFilters {
  country?: string;
  jurisdiction?: string;
  /** Restrict to a single act (used by the rerank step in rag.service). */
  actName?: string;
  /**
   * Only return vectors produced by this embedding model.
   * Required to prevent mixed-model cosine comparisons.
   */
  embeddingModel?: string;
}

/**
 * Diagnostic counts for a document's indexing state. Used by the RAG
 * pipeline to surface a meaningful `notFoundReason` when retrieval returns
 * no matches: did the document never produce chunks, are embeddings still
 * pending, or did all chunks land below the similarity floor?
 */
export interface DocumentChunkStats {
  total: number;
  embedded: number;
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
    /** When set, only rows with this embeddingModel are considered. */
    embeddingModel?: string,
  ): Promise<VectorSearchResult<Chunk>[]>;

  /** Search legal embeddings by embedding similarity. Uses denormalized columns (no JOIN). Returns embedding + sourceName, section, country, jurisdiction, url. */
  searchLegalChunks(
    queryEmbedding: number[],
    filters?: LegalChunkFilters,
    limit?: number,
  ): Promise<LegalChunkSearchResult[]>;

  /**
   * Return chunk indexing stats for a document: total rows and how many
   * have a non-null embedding. Used by the RAG pre-flight diagnostic.
   */
  getDocumentChunkStats(documentId: string): Promise<DocumentChunkStats>;
}

/** Injection token for IVectorStore */
export const VECTOR_STORE = Symbol('VECTOR_STORE');
