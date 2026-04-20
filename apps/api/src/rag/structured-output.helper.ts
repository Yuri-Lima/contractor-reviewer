import { Logger } from '@nestjs/common';
import type { LlmMessage, LlmCompleteOptions } from '@contractai-review/shared';
import type { z } from 'zod';
import type {
  ILlmProvider,
  LlmStructuredSchema,
} from '../llm/interfaces/llm-provider.interface';

const logger = new Logger('StructuredOutputHelper');

export interface StructuredOutputAttempt<T> {
  success: boolean;
  data: T | null;
  raw: string;
  attempts: number;
  validationErrors?: string[];
}

/**
 * Issue a structured-output call against `provider`, validate with `zodSchema`,
 * and retry once with a corrective `system` message if validation fails.
 *
 * Retry message contract (pinned, not hand-waved):
 *
 *     Your previous response did not match the required JSON schema "{name}".
 *
 *     Validation errors:
 *     <first 3 Zod issue paths joined by newlines>
 *
 *     Your previous output (truncated to 1500 chars):
 *     <raw.substring(0, 1500)>
 *
 *     Return ONLY valid JSON matching the schema. Do not include any prose,
 *     code fences, or commentary.
 *
 * The full schema is NOT re-sent because OpenAI's `json_schema` mode and
 * Anthropic's tool definition already carry it server-side.
 *
 * Returns `{ success: false, data: null, raw }` on a still-invalid retry —
 * the caller is expected to surface a graceful-degradation answer.
 */
export async function completeStructuredWithRetry<T>(
  provider: ILlmProvider,
  messages: LlmMessage[],
  schema: LlmStructuredSchema,
  zodSchema: z.ZodType<T>,
  options?: LlmCompleteOptions,
): Promise<StructuredOutputAttempt<T>> {
  const first = await provider.completeStructured(messages, schema, options);
  const firstValidation = zodSchema.safeParse(first.parsed);
  if (firstValidation.success) {
    return { success: true, data: firstValidation.data, raw: first.raw, attempts: 1 };
  }

  const validationErrors = firstValidation.error.issues
    .slice(0, 3)
    .map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`);

  logger.warn(
    `[completeStructuredWithRetry] first attempt invalid, retrying once. provider=${provider.id} schema=${schema.name} errors=${JSON.stringify(validationErrors)}`,
  );

  const retryMessages: LlmMessage[] = [
    ...messages,
    {
      role: 'system',
      content:
        `Your previous response did not match the required JSON schema "${schema.name}".\n\n` +
        `Validation errors:\n${validationErrors.join('\n')}\n\n` +
        `Your previous output (truncated to 1500 chars):\n${first.raw.substring(0, 1500)}\n\n` +
        `Return ONLY valid JSON matching the schema. Do not include any prose, code fences, or commentary.`,
    },
  ];

  const second = await provider.completeStructured(retryMessages, schema, options);
  const secondValidation = zodSchema.safeParse(second.parsed);
  if (secondValidation.success) {
    return { success: true, data: secondValidation.data, raw: second.raw, attempts: 2 };
  }

  const secondErrors = secondValidation.error.issues
    .slice(0, 3)
    .map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`);
  logger.warn(
    `[completeStructuredWithRetry] retry still invalid. provider=${provider.id} schema=${schema.name} errors=${JSON.stringify(secondErrors)}`,
  );

  return {
    success: false,
    data: null,
    raw: second.raw || first.raw,
    attempts: 2,
    validationErrors: secondErrors,
  };
}
