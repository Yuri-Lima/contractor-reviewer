import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import type { LlmMessage, LlmCompleteOptions } from '@contractai-review/shared';
import { LLM_PROVIDER_ID } from '@contractai-review/shared';
import type {
  ILlmProvider,
  LlmStructuredResult,
  LlmStructuredSchema,
} from '../interfaces/llm-provider.interface';

const DEFAULT_LLM_MAX_TOKENS = 2000;

@Injectable()
export class AnthropicLlmAdapter implements ILlmProvider {
  private readonly logger = new Logger(AnthropicLlmAdapter.name);
  readonly id = LLM_PROVIDER_ID.Anthropic;
  private readonly client: Anthropic;
  private readonly defaultModel: string;
  private readonly defaultMaxTokens: number;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY');
    this.client = new Anthropic({ apiKey: apiKey || 'dummy-key' });
    this.defaultModel =
      this.configService.get<string>('ANTHROPIC_CHAT_MODEL') || 'claude-sonnet-4-20250514';
    const raw = this.configService.get<string>('LLM_MAX_TOKENS');
    const parsed = raw ? parseInt(raw, 10) : DEFAULT_LLM_MAX_TOKENS;
    this.defaultMaxTokens = parsed > 0 ? parsed : DEFAULT_LLM_MAX_TOKENS;
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

    const response = await this.client.messages.create(
      {
        model: options?.model ?? this.defaultModel,
        max_tokens: options?.maxTokens ?? this.defaultMaxTokens,
        // Forward temperature when provided (was previously dropped — bug fix).
        ...(options?.temperature !== undefined ? { temperature: options.temperature } : {}),
        system: systemContent || undefined,
        messages: anthropicMessages,
      },
      // Forward AbortSignal via SDK request-options arg (was previously dropped — bug fix).
      options?.signal ? { signal: options.signal } : undefined,
    );

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

    const stream = this.client.messages.stream(
      {
        model: options?.model ?? this.defaultModel,
        max_tokens: options?.maxTokens ?? this.defaultMaxTokens,
        ...(options?.temperature !== undefined ? { temperature: options.temperature } : {}),
        system: systemContent || undefined,
        messages: anthropicMessages,
      },
      options?.signal ? { signal: options.signal } : undefined,
    );

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

  async completeStructured(
    messages: LlmMessage[],
    schema: LlmStructuredSchema,
    options?: LlmCompleteOptions,
  ): Promise<LlmStructuredResult> {
    const model = options?.model ?? this.defaultModel;
    this.logger.log(
      `[completeStructured] start: model=${model} schema=${schema.name} messageCount=${messages.length}`,
    );

    const { systemMessages, chatMessages } = this.splitMessages(messages);
    const systemContent = systemMessages.map((m) => m.content).join('\n\n');
    const anthropicMessages = chatMessages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    const response = await this.client.messages.create(
      {
        model,
        max_tokens: options?.maxTokens ?? this.defaultMaxTokens,
        ...(options?.temperature !== undefined ? { temperature: options.temperature } : {}),
        system: systemContent || undefined,
        messages: anthropicMessages,
        // Anthropic structured-output pattern: declare a single tool with the
        // target schema and force the model to use it via tool_choice.
        tools: [
          {
            name: schema.name,
            description: schema.description ?? `Return a ${schema.name} object`,
            // The Anthropic SDK types `input_schema` as a specific record shape;
            // our jsonSchema is a generic object compatible with JSON Schema draft-7.
            input_schema: schema.jsonSchema as unknown as {
              type: 'object';
              properties?: Record<string, unknown>;
            },
          },
        ],
        tool_choice: { type: 'tool', name: schema.name },
      },
      options?.signal ? { signal: options.signal } : undefined,
    );

    const toolUseBlock = response.content.find((b) => b.type === 'tool_use');
    if (!toolUseBlock || toolUseBlock.type !== 'tool_use') {
      this.logger.warn(
        `[completeStructured] no tool_use block in response (schema=${schema.name})`,
      );
      return { raw: '', parsed: null };
    }

    // tool_use.input is already the parsed JSON object per Anthropic's API.
    const parsed = toolUseBlock.input ?? null;
    const raw = JSON.stringify(parsed ?? {});
    return { raw, parsed };
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
