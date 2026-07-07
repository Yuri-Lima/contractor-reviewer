import { EntityManager, Repository } from 'typeorm';
import { Document } from '../entities/document.entity';

/**
 * Acquire an exclusive row lock on a document for the duration of a worker
 * transaction. Prevents two concurrent BullMQ jobs for the same document from
 * interleaving chunk/file writes (last-writer-wins race).
 *
 * Uses PostgreSQL `SELECT … FOR UPDATE` via TypeORM pessimistic_write.
 */
export async function lockDocumentForUpdate(
  manager: EntityManager,
  documentId: string,
): Promise<Document> {
  const document = await manager.getRepository(Document).findOne({
    where: { id: documentId },
    lock: { mode: 'pessimistic_write' },
  });
  if (!document) {
    throw new Error(`Document ${documentId} not found (lock)`);
  }
  return document;
}

/**
 * Run `fn` inside a transaction that holds a pessimistic write lock on the
 * document row. Any concurrent job for the same document blocks until this
 * transaction commits or rolls back — eliminating the dual-chunk overwrite race.
 */
export async function withDocumentLock<T>(
  documentRepository: Repository<Document>,
  documentId: string,
  fn: (manager: EntityManager, document: Document) => Promise<T>,
): Promise<T> {
  return documentRepository.manager.transaction(async (manager) => {
    const document = await lockDocumentForUpdate(manager, documentId);
    return fn(manager, document);
  });
}
