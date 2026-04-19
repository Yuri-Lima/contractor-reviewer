import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatThread } from '../entities/chat-thread.entity';
import { DocumentsService } from './documents.service';

const DEFAULT_TITLE_LENGTH = 80;

export interface ListThreadsOptions {
  page?: number;
  limit?: number;
}

export interface ListThreadsResult {
  threads: ChatThread[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class ChatThreadService {
  constructor(
    @InjectRepository(ChatThread)
    private threadRepository: Repository<ChatThread>,
    private documentsService: DocumentsService,
  ) {}

  /**
   * List threads for a document, filtered by userId (users see only their own).
   * Sorted by updatedAt desc.
   */
  async listThreads(
    documentId: string,
    workspaceId: string,
    userId: string,
    options: ListThreadsOptions = {},
  ): Promise<ListThreadsResult> {
    await this.documentsService.findById(documentId, workspaceId);

    const page = Math.max(1, options.page ?? 1);
    const limit = Math.min(100, Math.max(1, options.limit ?? 20));
    const skip = (page - 1) * limit;

    const [threads, total] = await this.threadRepository.findAndCount({
      where: { documentId, workspaceId, userId },
      order: { updatedAt: 'DESC' },
      skip,
      take: limit,
    });

    return {
      threads,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Create a new thread (optional title).
   */
  async createThread(
    documentId: string,
    workspaceId: string,
    userId: string,
    title?: string | null,
  ): Promise<ChatThread> {
    await this.documentsService.findById(documentId, workspaceId);

    const thread = this.threadRepository.create({
      documentId,
      workspaceId,
      userId,
      title: title ?? null,
    });

    return this.threadRepository.save(thread);
  }

  /**
   * Get thread by id with documentId. Enforces workspaceId and userId (user can only access own threads).
   */
  async findByThreadId(
    threadId: string,
    workspaceId: string,
    userId: string,
  ): Promise<ChatThread> {
    const thread = await this.threadRepository.findOne({
      where: { id: threadId, workspaceId, userId },
    });

    if (!thread) {
      throw new NotFoundException('Thread not found');
    }

    return thread;
  }

  /**
   * Get thread by id. Enforces workspaceId and userId (user can only access own threads).
   */
  async findById(
    threadId: string,
    documentId: string,
    workspaceId: string,
    userId: string,
  ): Promise<ChatThread> {
    await this.documentsService.findById(documentId, workspaceId);

    const thread = await this.threadRepository.findOne({
      where: { id: threadId, documentId, workspaceId, userId },
    });

    if (!thread) {
      throw new NotFoundException('Thread not found');
    }

    return thread;
  }

  /**
   * Delete thread and cascade messages. RBAC: user can delete own; ADMIN/OWNER can delete any.
   * Returns messageCount for audit.
   */
  async deleteThread(
    threadId: string,
    documentId: string,
    workspaceId: string,
    userId: string,
    canDeleteAny: boolean,
  ): Promise<{ messageCount: number }> {
    await this.documentsService.findById(documentId, workspaceId);

    const thread = await this.threadRepository.findOne({
      where: { id: threadId, documentId, workspaceId },
      relations: ['messages'],
    });

    if (!thread) {
      throw new NotFoundException('Thread not found');
    }

    if (!canDeleteAny && thread.userId !== userId) {
      throw new ForbiddenException('Cannot delete another user\'s thread');
    }

    const messageCount = thread.messages?.length ?? 0;
    await this.threadRepository.remove(thread);
    return { messageCount };
  }

  /**
   * Create thread or return existing. Used when POST /chat has no threadId.
   */
  async getOrCreateThread(
    documentId: string,
    workspaceId: string,
    userId: string,
    firstQuestion?: string,
  ): Promise<ChatThread> {
    // Create new thread for each new conversation (no threadId = new thread)
    const title = firstQuestion
      ? firstQuestion.slice(0, DEFAULT_TITLE_LENGTH) +
        (firstQuestion.length > DEFAULT_TITLE_LENGTH ? '...' : '')
      : null;

    return this.createThread(documentId, workspaceId, userId, title);
  }

  /**
   * Update thread title (e.g. when first message is saved).
   */
  async updateTitle(
    threadId: string,
    documentId: string,
    workspaceId: string,
    userId: string,
    title: string,
  ): Promise<ChatThread> {
    const thread = await this.findById(threadId, documentId, workspaceId, userId);
    thread.title = title.slice(0, DEFAULT_TITLE_LENGTH) + (title.length > DEFAULT_TITLE_LENGTH ? '...' : '');
    return this.threadRepository.save(thread);
  }
}
