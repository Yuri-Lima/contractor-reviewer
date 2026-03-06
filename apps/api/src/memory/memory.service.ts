import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Memory, type MemoryScopeType } from '../entities/memory.entity';

@Injectable()
export class MemoryService {
  constructor(
    @InjectRepository(Memory)
    private memoryRepository: Repository<Memory>,
  ) {}

  /**
   * Upsert memory for a scope (thread, document, or workspace).
   * Replaces existing content and increments version.
   */
  async upsert(
    scopeType: MemoryScopeType,
    scopeId: string,
    workspaceId: string,
    content: string,
  ): Promise<Memory> {
    const existing = await this.memoryRepository.findOne({
      where: { scopeType, scopeId },
    });

    if (existing) {
      existing.content = content;
      existing.version += 1;
      existing.updatedAt = new Date();
      return this.memoryRepository.save(existing);
    }

    const memory = this.memoryRepository.create({
      scopeType,
      scopeId,
      workspaceId,
      content,
      version: 1,
    });
    return this.memoryRepository.save(memory);
  }

  /**
   * Get memory for a scope, or null if not found.
   */
  async getByScope(
    scopeType: MemoryScopeType,
    scopeId: string,
  ): Promise<Memory | null> {
    return this.memoryRepository.findOne({
      where: { scopeType, scopeId },
    });
  }

  /**
   * Get memory content for a scope, or undefined if not found.
   */
  async getContent(
    scopeType: MemoryScopeType,
    scopeId: string,
  ): Promise<string | undefined> {
    const memory = await this.getByScope(scopeType, scopeId);
    return memory?.content;
  }

  /**
   * Get document and thread memory content for RAG context injection.
   * Returns combined markdown or undefined if neither exists.
   */
  async getDocumentAndThreadMemory(
    documentId: string,
    threadId: string | null,
  ): Promise<string | undefined> {
    const [docMemory, threadMemory] = await Promise.all([
      this.getContent('document', documentId),
      threadId ? this.getContent('thread', threadId) : Promise.resolve(undefined),
    ]);

    const parts: string[] = [];
    if (docMemory) parts.push(`## Document memory\n${docMemory}`);
    if (threadMemory) parts.push(`## Thread memory\n${threadMemory}`);
    if (parts.length === 0) return undefined;
    return parts.join('\n\n');
  }

  /**
   * Delete memory for a scope.
   */
  async deleteByScope(
    scopeType: MemoryScopeType,
    scopeId: string,
  ): Promise<void> {
    await this.memoryRepository.delete({ scopeType, scopeId });
  }

  /**
   * Delete all memories for a document (document-level and its threads).
   * Call when document is hard-deleted.
   */
  async deleteByDocument(documentId: string): Promise<void> {
    await this.memoryRepository.delete({ scopeType: 'document', scopeId: documentId });
    // Thread memories are deleted when threads are deleted (handled by purge/cascade)
  }

  /**
   * Delete all memories for a thread.
   */
  async deleteByThread(threadId: string): Promise<void> {
    await this.memoryRepository.delete({ scopeType: 'thread', scopeId: threadId });
  }

  /**
   * Delete all memories for a workspace.
   */
  async deleteByWorkspace(workspaceId: string): Promise<void> {
    await this.memoryRepository.delete({ workspaceId });
  }

  /**
   * List memories for a workspace (for DSAR export).
   */
  async listByWorkspace(workspaceId: string): Promise<Memory[]> {
    return this.memoryRepository.find({
      where: { workspaceId },
      order: { updatedAt: 'DESC' },
    });
  }
}
