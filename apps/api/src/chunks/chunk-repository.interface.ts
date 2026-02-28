import { Chunk } from '../entities/chunk.entity';

/** DTO for creating chunks (used by ChunkingProcessor) */
export interface CreateChunkDto {
  documentId: string;
  text: string;
  pageNumber?: number;
  paragraphId?: string;
  startIndex: number;
  endIndex: number;
}

/**
 * Abstraction over chunk storage.
 * Centralizes all chunk CRUD so the implementation can be swapped
 * (e.g. to a separate vector DB) without changing consumers.
 */
export interface IChunkRepository {
  /** Create chunks from DTOs, returns saved chunks with IDs */
  create(data: CreateChunkDto[]): Promise<Chunk[]>;

  /** Get all chunks for a document, ordered by pageNumber and startIndex */
  findByDocumentId(documentId: string): Promise<Chunk[]>;

  /** Delete all chunks for a document. Returns count of deleted chunks. */
  deleteByDocumentId(documentId: string): Promise<number>;

  /** Get chunks by IDs */
  findByIds(ids: string[]): Promise<Chunk[]>;

  /** Save (update) existing chunks */
  save(chunks: Chunk[]): Promise<Chunk[]>;
}

/** Injection token for IChunkRepository */
export const CHUNK_REPOSITORY = Symbol('CHUNK_REPOSITORY');
