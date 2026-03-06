import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatMessage } from '../entities/chat-message.entity';
import { MemoryService } from '../memory/memory.service';
import { LlmProviderRegistry } from '../llm/llm-provider.registry';

export interface SummarizeMemoryJobData {
  threadId: string;
  documentId: string;
  workspaceId: string;
}

const SUMMARIZE_SYSTEM = `You are summarizing a contract Q&A conversation. Output a concise markdown summary (2-4 bullet points) covering:
- Key topics and questions discussed
- Main findings or answers
- Any open questions or uncertainties

Keep it factual and brief. No preamble.`;

@Processor('memory', {
  stalledInterval: 60000,
  maxStalledCount: 1,
})
@Injectable()
export class SummarizeMemoryProcessor extends WorkerHost {
  private readonly logger = new Logger(SummarizeMemoryProcessor.name);

  constructor(
    @InjectRepository(ChatMessage)
    private chatMessageRepository: Repository<ChatMessage>,
    private memoryService: MemoryService,
    private llmProviderRegistry: LlmProviderRegistry,
  ) {
    super();
  }

  async process(
    job: Job<SummarizeMemoryJobData>,
    _token?: string,
  ): Promise<void> {
    const { threadId, documentId, workspaceId } = job.data;

    this.logger.log(
      `[SummarizeMemory] Processing: threadId=${threadId} documentId=${documentId}`,
    );

    const messages = await this.chatMessageRepository.find({
      where: { threadId },
      order: { createdAt: 'ASC' },
    });

    if (messages.length === 0) {
      this.logger.log(`[SummarizeMemory] No messages for threadId=${threadId}, skipping`);
      return;
    }

    const transcript = messages
      .map(
        (m) =>
          `User: ${m.question || ''}\nAssistant: ${m.answerText ?? '(no answer)'}`,
      )
      .join('\n\n');

    const provider = await this.llmProviderRegistry.resolveProvider(workspaceId);
    const summary = await provider.complete(
      [
        { role: 'system', content: SUMMARIZE_SYSTEM },
        { role: 'user', content: `Summarize this conversation:\n\n${transcript}` },
      ],
      { maxTokens: 300, temperature: 0.2 },
    );

    await this.memoryService.upsert('thread', threadId, workspaceId, summary);
    this.logger.log(
      `[SummarizeMemory] Upserted thread memory: threadId=${threadId} summaryLength=${summary.length}`,
    );
  }
}
