import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import type { LlmMessage, LlmCompleteOptions } from '@contractai-review/shared';
import { LlmProviderId } from '@contractai-review/shared';
import type { ILlmProvider } from '../interfaces/llm-provider.interface';

@Injectable()
export class AnthropicLlmAdapter implements ILlmProvider {
  private readonly logger = new Logger(AnthropicLlmAdapter.name);
  readonly id = LlmProviderId.Anthropic;
  private readonly client: Anthropic;
  private readonly defaultModel: string;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY');
    this.client = new Anthropic({ apiKey: apiKey || 'dummy-key' });
    this.defaultModel =
      this.configService.get<string>('ANTHROPIC_CHAT_MODEL') || 'claude-sonnet-4-20250514';
  }

  async complete(
    messages: LlmMessage[],
    options?: LlmCompleteOptions,
  ): Promise<string> {
    const { systemMessages, chatMessages } = this.splitMessages(messages);

    const systemContent = systemMessages.map((m) => m.content).join('\n\n');
    const anthropicMessages = chatMessages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    const response = await this.client.messages.create({
      model: options?.model ?? this.defaultModel,
      max_tokens: options?.maxTokens ?? 500,
      system: systemContent || undefined,
      messages: anthropicMessages,
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    return textBlock && 'text' in textBlock ? textBlock.text : 'NOT FOUND';
  }

  async *completeStream(
    messages: LlmMessage[],
    options?: LlmCompleteOptions,
  ): AsyncIterable<string> {
    this.logger.log(
      `[completeStream] LLM provider.completeStream start: model=${options?.model ?? this.defaultModel} messageCount=${messages.length}`,
    );
    const { systemMessages, chatMessages } = this.splitMessages(messages);
    const systemContent = systemMessages.map((m) => m.content).join('\n\n');
    const anthropicMessages = chatMessages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    const stream = this.client.messages.stream({
      model: options?.model ?? this.defaultModel,
      max_tokens: options?.maxTokens ?? 500,
      system: systemContent || undefined,
      messages: anthropicMessages,
    });

    let chunkCount = 0;
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        chunkCount++;
        yield event.delta.text;
      }
    }
    this.logger.log(
      `[completeStream] LLM provider.completeStream done: chunkCount=${chunkCount}`,
    );
  }

  private splitMessages(messages: LlmMessage[]): {
    systemMessages: LlmMessage[];
    chatMessages: LlmMessage[];
  } {
    const systemMessages = messages.filter((m) => m.role === 'system');
    const chatMessages = messages.filter((m) => m.role !== 'system');
    return { systemMessages, chatMessages };
  }
}
