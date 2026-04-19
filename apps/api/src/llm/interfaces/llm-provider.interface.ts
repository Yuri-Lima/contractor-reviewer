import type { LlmMessage, LlmCompleteOptions } from '@contractai-review/shared';

export interface ILlmProvider {
  readonly id: string;
  complete(
    messages: LlmMessage[],
    options?: LlmCompleteOptions,
  ): Promise<string>;
  completeStream(
    messages: LlmMessage[],
    options?: LlmCompleteOptions,
  ): AsyncIterable<string>;
}
