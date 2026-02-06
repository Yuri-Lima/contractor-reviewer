import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatMessage } from '../entities/chat-message.entity';
import { RagResponse } from '../rag/rag.service';
import { WorkspaceSettings } from '../entities/workspace-settings.entity';

@Injectable()
export class ChatMessageService {
  constructor(
    @InjectRepository(ChatMessage)
    private chatMessageRepository: Repository<ChatMessage>,
    @InjectRepository(WorkspaceSettings)
    private settingsRepository: Repository<WorkspaceSettings>,
  ) {}

  /**
   * Save chat message respecting no-logs configuration
   */
  async saveChatMessage(
    documentId: string,
    workspaceId: string,
    userId: string,
    question: string,
    response: RagResponse,
    jurisdiction?: string,
  ): Promise<ChatMessage | null> {
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

    // Create chat message
    const chatMessage = this.chatMessageRepository.create({
      documentId,
      workspaceId,
      userId,
      question: (noLogsEnabled && skipChatMessages) ? '[REDACTED]' : question, // Redact question if no-logs enabled and skipChatMessages is true
      answerText: (noLogsEnabled && skipChatMessages) ? null : response.answerText,
      confidence: response.confidence,
      citations: (noLogsEnabled && skipChatMessages) ? null : response.citations,
      notFound: response.notFound,
      jurisdiction: jurisdiction || null,
    });

    return await this.chatMessageRepository.save(chatMessage);
  }
}
