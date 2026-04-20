import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ILlmProvider } from '../llm/interfaces/llm-provider.interface';

/**
 * Resolves the model to use for high-stakes legal-review LLM calls.
 *
 * Lookup order (per call site):
 *   1. Per-call `options.model`            (highest precedence; e.g. cached payload override)
 *   2. `LEGAL_REVIEW_MODEL_<PROVIDER>` env (this resolver)
 *   3. Adapter `defaultModel`              (fallback; resolver returns `undefined`)
 *
 * The escape hatch lets ops point structured legal-review calls at a
 * stronger model (e.g. `gpt-4o`, `claude-opus-4-7`) without inventing a
 * full task-profile system. Forward-compat note: when the LLM Task Profiles
 * plan lands, this resolver is replaced by
 * `registry.resolveForTask(workspaceId, HighStakesReasoning)`.
 */
@Injectable()
export class LegalReviewModelResolver {
  private readonly logger = new Logger(LegalReviewModelResolver.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Returns the LEGAL_REVIEW_MODEL_<PROVIDER> override, or `undefined` if
   * unset (caller should let the adapter use its own `defaultModel`).
   */
  resolve(provider: ILlmProvider): string | undefined {
    const key = `LEGAL_REVIEW_MODEL_${provider.id.toUpperCase()}`;
    const value = this.configService.get<string>(key);
    if (value && value.trim().length > 0) {
      this.logger.debug(
        `[resolve] provider=${provider.id} overriding model via ${key}=${value}`,
      );
      return value.trim();
    }
    return undefined;
  }
}
