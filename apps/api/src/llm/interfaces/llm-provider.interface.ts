import type { LlmMessage, LlmCompleteOptions } from '@contractai-review/shared';

/**
 * JSON-Schema descriptor for `completeStructured`. The `name` is also used as
 * the tool name in the Anthropic adapter implementation.
 */
export interface LlmStructuredSchema {
  name: string;
  /** A JSON Schema object (typically generated from a Zod schema). */
  jsonSchema: Record<string, unknown>;
  /** Optional human-friendly description for the model. */
  description?: string;
}

/**
 * Result of a structured-output call. The adapter never validates against the
 * JSON schema with a runtime validator — that's the call-site's job (so it can
 * keep its narrow `T` type). The adapter only does provider-side enforcement
 * (OpenAI/xAI `json_schema` mode, Anthropic single-tool `tool_choice`).
 *
 * `parsed` is `null` only when the raw string failed `JSON.parse` (very rare
 * with provider-side enforcement; surfaces SDK quirks like empty content).
 */
export interface LlmStructuredResult {
  raw: string;
  parsed: unknown | null;
}

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
  /**
   * Issue a completion request with provider-side structured-output enforcement.
   * The provider returns one JSON value matching `schema.jsonSchema`. Returns
   * both the raw string and a best-effort `JSON.parse` result; the call site
   * runs Zod (or other) validation against `parsed`.
   */
  completeStructured(
    messages: LlmMessage[],
    schema: LlmStructuredSchema,
    options?: LlmCompleteOptions,
  ): Promise<LlmStructuredResult>;
}
