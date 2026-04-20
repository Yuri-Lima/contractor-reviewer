import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenAI } from 'openai';
import type { LlmMessage, LlmCompleteOptions } from '@contractai-review/shared';
import { LLM_PROVIDER_ID } from '@contractai-review/shared';
import type {
  ILlmProvider,
  LlmStructuredResult,
  LlmStructuredSchema,
} from '../interfaces/llm-provider.interface';

const DEFAULT_LLM_MAX_TOKENS = 2000;
const XAI_BASE_URL = 'https://api.x.ai/v1';
const DEFAULT_XAI_MODEL = 'grok-4-1-fast-reasoning';

/**
 * Adapter for xAI's Grok models. xAI exposes an OpenAI-compatible
 * `/v1/chat/completions` endpoint, so we reuse the `openai` SDK and
 * just point `baseURL` at `https://api.x.ai/v1`.
 *
 * Note: xAI does NOT provide an embeddings endpoint. Embeddings continue
 * to be served by `EmbeddingsService` (OpenAI), even when this provider
 * is selected for chat.
 */
@Injectable()
export class XaiLlmAdapter implements ILlmProvider {
  private readonly logger = new Logger(XaiLlmAdapter.name);
  readonly id = LLM_PROVIDER_ID.XAI;
  private readonly client: OpenAI;
  private readonly defaultModel: string;
  private readonly defaultMaxTokens: number;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('XAI_API_KEY');
    this.client = new OpenAI({
      apiKey: apiKey || 'dummy-key',
      baseURL: XAI_BASE_URL,
    });
    this.defaultModel =
      this.configService.get<string>('XAI_CHAT_MODEL') || DEFAULT_XAI_MODEL;
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
        max_completion_tokens: options?.maxTokens ?? this.defaultMaxTokens,
      },
      { signal: options?.signal },
    );
    return response.choices[0]?.message?.content || 'NOT FOUND';
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
        max_completion_tokens: options?.maxTokens ?? this.defaultMaxTokens,
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

  async completeStructured(
    messages: LlmMessage[],
    schema: LlmStructuredSchema,
    options?: LlmCompleteOptions,
  ): Promise<LlmStructuredResult> {
    const model = options?.model ?? this.defaultModel;
    this.logger.log(
      `[completeStructured] start: model=${model} schema=${schema.name} messageCount=${messages.length}`,
    );
    const response = await this.client.chat.completions.create(
      {
        model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        temperature: options?.temperature ?? 0,
        max_completion_tokens: options?.maxTokens ?? this.defaultMaxTokens,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: schema.name,
            schema: schema.jsonSchema,
            strict: true,
          },
        },
      },
      { signal: options?.signal },
    );

    const raw = response.choices[0]?.message?.content ?? '';
    let parsed: unknown | null = null;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch (err) {
      this.logger.warn(
        `[completeStructured] JSON.parse failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      parsed = null;
    }
    return { raw, parsed };
  }
}
