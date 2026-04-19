import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatMessage } from '../entities/chat-message.entity';
import { RagResponse } from '../rag/rag.service';
import { WorkspaceSettings } from '../entities/workspace-settings.entity';
import { ChatThreadService } from './chat-thread.service';

export interface MessageListResult {
  messages: ChatMessage[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class ChatMessageService {
  private readonly logger = new Logger(ChatMessageService.name);

  constructor(
    @InjectRepository(ChatMessage)
    private chatMessageRepository: Repository<ChatMessage>,
    @InjectRepository(WorkspaceSettings)
    private settingsRepository: Repository<WorkspaceSettings>,
    private chatThreadService: ChatThreadService,
  ) {}

  /**
   * Save chat message respecting no-logs configuration.
   * Stores one row per exchange: role='user', question + answerText.
   */
  async saveChatMessage(
    documentId: string,
    workspaceId: string,
    userId: string,
    question: string,
    response: RagResponse,
    jurisdiction?: string,
    threadId?: string,
  ): Promise<ChatMessage | null> {
    this.logger.log(
      `[saveChatMessage] documentId=${documentId} workspaceId=${workspaceId} threadId=${threadId ?? 'none'}`,
    );
    // Check no-logs configuration
    const settings = await this.settingsRepository.findOne({
      where: { workspaceId },
    });

    const noLogsEnabled = settings?.noLogsEnabled || false;
    const skipChatMessages = settings?.noLogsConfig?.skipChatMessages || false;

    // If no-logs is enabled and skipChatMessages is true, don't persist
    if (noLogsEnabled && skipChatMessages) {
      return null;
    }

    if (!threadId) {
      throw new Error('threadId is required when saving chat message');
    }

    // Create chat message (one row per exchange: user question + assistant answer)
    const chatMessage = this.chatMessageRepository.create({
      threadId,
      documentId,
      workspaceId,
      userId,
      role: 'user',
      question: (noLogsEnabled && skipChatMessages) ? '[REDACTED]' : question,
      answerText: (noLogsEnabled && skipChatMessages) ? null : response.answerText,
      confidence: response.confidence,
      citations: (noLogsEnabled && skipChatMessages) ? null : response.citations,
      notFound: response.notFound,
      jurisdiction: jurisdiction || null,
    });

    return await this.chatMessageRepository.save(chatMessage);
  }

  /**
   * Get messages for a thread (paginated). Enforces workspaceId access.
   */
  async getMessages(
    threadId: string,
    workspaceId: string,
    userId: string,
    options: { page?: number; limit?: number } = {},
  ): Promise<MessageListResult> {
    await this.chatThreadService.findByThreadId(threadId, workspaceId, userId);

    const page = Math.max(1, options.page ?? 1);
    const limit = Math.min(100, Math.max(1, options.limit ?? 20));
    const skip = (page - 1) * limit;

    const [messages, total] = await this.chatMessageRepository.findAndCount({
      where: { threadId },
      order: { createdAt: 'ASC' },
      skip,
      take: limit,
    });

    return {
      messages,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get all messages for a thread (for export). Enforces workspaceId access.
   */
  async getAllMessagesForExport(
    threadId: string,
    workspaceId: string,
    userId: string,
  ): Promise<ChatMessage[]> {
    await this.chatThreadService.findByThreadId(threadId, workspaceId, userId);
    return this.chatMessageRepository.find({
      where: { threadId },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Get recent messages for conversation history (last N exchanges).
   * Returns alternating user/assistant content for prompt construction.
   */
  async getRecentMessages(
    threadId: string,
    workspaceId: string,
    userId: string,
    limit: number = 5,
  ): Promise<{ role: 'user' | 'assistant'; content: string }[]> {
    await this.chatThreadService.findByThreadId(threadId, workspaceId, userId);

    const messages = await this.chatMessageRepository.find({
      where: { threadId },
      order: { createdAt: 'DESC' },
      take: limit,
    });

    const result: { role: 'user' | 'assistant'; content: string }[] = [];
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.question) {
        result.push({ role: 'user', content: m.question });
      }
      if (m.answerText) {
        result.push({ role: 'assistant', content: m.answerText });
      }
    }
    return result;
  }
}
