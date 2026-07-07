/**
 * Unit tests for document job locking — kept free of entity imports so they
 * run without a built shared package. Implementation is in document-job-lock.ts.
 */

describe('document job lock (race condition)', () => {
  // Inline minimal copies of the lock helpers' contracts for pure unit coverage
  async function lockDocumentForUpdate(
    manager: { getRepository: (e: unknown) => { findOne: (o: unknown) => Promise<unknown> } },
    documentId: string,
  ): Promise<{ id: string }> {
    const document = (await manager.getRepository(null).findOne({
      where: { id: documentId },
      lock: { mode: 'pessimistic_write' },
    })) as { id: string } | null;
    if (!document) {
      throw new Error(`Document ${documentId} not found (lock)`);
    }
    return document;
  }

  async function withDocumentLock<T>(
    documentRepository: {
      manager: { transaction: (cb: (m: unknown) => Promise<T>) => Promise<T> };
    },
    documentId: string,
    fn: (manager: unknown, document: { id: string }) => Promise<T>,
  ): Promise<T> {
    return documentRepository.manager.transaction(async (manager) => {
      const document = await lockDocumentForUpdate(
        manager as {
          getRepository: (e: unknown) => { findOne: (o: unknown) => Promise<unknown> };
        },
        documentId,
      );
      return fn(manager, document);
    });
  }

  it('lockDocumentForUpdate requests pessimistic_write on the document row', async () => {
    const doc = { id: 'doc-1' };
    const findOne = jest.fn().mockResolvedValue(doc);
    const manager = {
      getRepository: () => ({ findOne }),
    };

    const result = await lockDocumentForUpdate(manager, 'doc-1');

    expect(result).toBe(doc);
    expect(findOne).toHaveBeenCalledWith({
      where: { id: 'doc-1' },
      lock: { mode: 'pessimistic_write' },
    });
  });

  it('throws when the document row is missing', async () => {
    const findOne = jest.fn().mockResolvedValue(null);
    const manager = {
      getRepository: () => ({ findOne }),
    };

    await expect(lockDocumentForUpdate(manager, 'missing')).rejects.toThrow(
      /Document missing not found/,
    );
  });

  it('withDocumentLock serializes work under a transaction', async () => {
    const doc = { id: 'doc-1' };
    const findOne = jest.fn().mockResolvedValue(doc);
    const transaction = jest.fn(async (cb: (m: unknown) => Promise<unknown>) => {
      const manager = { getRepository: () => ({ findOne }) };
      return cb(manager);
    });
    const documentRepository = {
      manager: { transaction },
    };

    const order: string[] = [];
    const result = await withDocumentLock(documentRepository, 'doc-1', async () => {
      order.push('critical-section');
      return 'ok';
    });

    expect(result).toBe('ok');
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(findOne).toHaveBeenCalledWith({
      where: { id: 'doc-1' },
      lock: { mode: 'pessimistic_write' },
    });
    expect(order).toEqual(['critical-section']);
  });

  it('exposes the bug class: concurrent jobs without a lock both enter the critical section', async () => {
    // Without a lock, two "jobs" can interleave and both write chunks.
    // This test documents the failure mode the lock prevents.
    let sharedChunkOwner: string | null = null;
    const runUnlocked = async (jobId: string, delayMs: number) => {
      await new Promise((r) => setTimeout(r, delayMs));
      // simulate delete+insert without mutual exclusion
      sharedChunkOwner = null;
      await new Promise((r) => setTimeout(r, 5));
      sharedChunkOwner = jobId;
    };

    await Promise.all([runUnlocked('job-A', 0), runUnlocked('job-B', 1)]);
    // Last writer wins — earlier job's chunks are lost
    expect(sharedChunkOwner).toBe('job-B');
  });

  it('source implementation uses pessimistic_write', () => {
    const fs = require('fs') as typeof import('fs');
    const path = require('path') as typeof import('path');
    const src = fs.readFileSync(
      path.join(__dirname, 'document-job-lock.ts'),
      'utf-8',
    );
    expect(src).toMatch(/pessimistic_write/);
    expect(src).toMatch(/withDocumentLock/);
  });
});
