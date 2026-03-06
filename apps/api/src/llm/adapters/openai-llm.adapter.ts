import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenAI } from 'openai';
import type { LlmMessage, LlmCompleteOptions } from '@contractai-review/shared';
import { LlmProviderId } from '@contractai-review/shared';
import type { ILlmProvider } from '../interfaces/llm-provider.interface';

const DEFAULT_LLM_MAX_TOKENS = 2000;

@Injectable()
export class OpenAILlmAdapter implements ILlmProvider {
  private readonly logger = new Logger(OpenAILlmAdapter.name);
  readonly id = LlmProviderId.OpenAI;
  private readonly client: OpenAI;
  private readonly defaultModel: string;
  private readonly defaultMaxTokens: number;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    this.client = new OpenAI({ apiKey: apiKey || 'dummy-key' });
    this.defaultModel =
      this.configService.get<string>('OPENAI_CHAT_MODEL') || 'gpt-4o-mini';
    const raw = this.configService.get<string>('LLM_MAX_TOKENS');
    const parsed = raw ? parseInt(raw, 10) : DEFAULT_LLM_MAX_TOKENS;
    this.defaultMaxTokens = parsed > 0 ? parsed : DEFAULT_LLM_MAX_TOKENS;
  }

  async complete(
    messages: LlmMessage[],
    options?: LlmCompleteOptions,
  ): Promise<string> {
    const response = await this.client.chat.completions.create(
      {
        model: options?.model ?? this.defaultModel,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        temperature: options?.temperature ?? 0.3,
        max_tokens: options?.maxTokens ?? this.defaultMaxTokens,
      },
      { signal: options?.signal },
    );
    return response.choices[0].message.content || 'NOT FOUND';
  }

  async *completeStream(
    messages: LlmMessage[],
    options?: LlmCompleteOptions,
  ): AsyncIterable<string> {
    this.logger.log(
      `[completeStream] LLM provider.completeStream start: model=${options?.model ?? this.defaultModel} messageCount=${messages.length}`,
    );
    const stream = await this.client.chat.completions.create(
      {
        model: options?.model ?? this.defaultModel,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        temperature: options?.temperature ?? 0.3,
        max_tokens: options?.maxTokens ?? this.defaultMaxTokens,
        stream: true,
      },
      { signal: options?.signal },
    );

    let chunkCount = 0;
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        chunkCount++;
        yield content;
      }
    }
    this.logger.log(
      `[completeStream] LLM provider.completeStream done: chunkCount=${chunkCount}`,
    );
  }
}
