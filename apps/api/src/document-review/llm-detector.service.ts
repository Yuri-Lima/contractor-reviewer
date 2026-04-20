import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  CompliantElement,
  LegalAnswer,
  LegalIssue,
  LlmMessage,
} from '@contractai-review/shared';
import { LlmProviderRegistry } from '../llm/llm-provider.registry';
import { LegalReviewModelResolver } from '../rag/legal-review-model-resolver.service';
import {
  LegalAnswerZ,
  LEGAL_ANSWER_JSON_SCHEMA,
  normaliseLegalAnswer,
  type LegalAnswerWire,
} from '../rag/legal-answer.schema';
import { completeStructuredWithRetry } from '../rag/structured-output.helper';

const MAX_WINDOW_CHARS = 16_000; // ~4k tokens — gpt-4o sweet spot
const WINDOW_OVERLAP = 800;

interface LlmDetectorOptions {
  workspaceId: string;
  jurisdiction?: string | null;
  signal?: AbortSignal;
}

interface LlmDetectorResult {
  issues: LegalIssue[];
  compliantElements: CompliantElement[];
  recommendations: string[];
  legislationReferenced: LegalAnswer['legislationReferenced'];
  status: 'succeeded' | 'degraded' | 'failed';
  modelUsed: string | null;
  errorMessage?: string;
}

const SYSTEM_PROMPT = `You are a senior legal contract reviewer. Inspect the
contract excerpt below and return a JSON object that conforms to the supplied
schema. Be exhaustive about issues that a careful human reviewer would flag,
including:
- placeholders / template artefacts ("[XX]", "tbc", literal "OR" alternative
  markers, "lorem ipsum"),
- jurisdiction-mismatch terminology (e.g. "qualifying earnings" in an Irish
  contract),
- missing references to governing statutes,
- vague or unenforceable clauses.

For each issue, populate \`clauseRef\` with the clause number when one appears
on or near the problematic text (e.g. "9.1.3"). Set \`severity\` honestly:
"blocker" only for items that would make the contract unsignable.

Return ONLY the JSON. Do not wrap it in prose.`;

/**
 * LLM-based red-flag detector. Splits the document into 16k-char windows and
 * asks the model to produce a structured `LegalAnswer` per window; the
 * orchestrator merges the windows.
 *
 * Fault tolerance: when the structured-output retry helper exhausts both
 * attempts, the window is dropped and the run is marked `degraded`.
 */
@Injectable()
export class LlmDetectorService {
  private readonly logger = new Logger(LlmDetectorService.name);

  constructor(
    private readonly llmProviderRegistry: LlmProviderRegistry,
    private readonly modelResolver: LegalReviewModelResolver,
    private readonly configService: ConfigService,
  ) {}

  async detect(text: string, opts: LlmDetectorOptions): Promise<LlmDetectorResult> {
    const provider = await this.llmProviderRegistry.resolveProvider(opts.workspaceId);
    const overrideModel = this.modelResolver.resolve(provider);

    const windows = this.windowText(text);
    const aggregated: LegalAnswer = {
      issues: [],
      compliantElements: [],
      recommendations: [],
      legislationReferenced: [],
      confidence: 'medium',
    };
    let degraded = false;

    for (let i = 0; i < windows.length; i++) {
      const window = windows[i];
      const messages: LlmMessage[] = [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: this.buildUserPrompt(window, opts.jurisdiction ?? null, i + 1, windows.length),
        },
      ];
      try {
        const attempt = await completeStructuredWithRetry<LegalAnswerWire>(
          provider,
          messages,
          {
            name: 'LegalAnswer',
            jsonSchema: LEGAL_ANSWER_JSON_SCHEMA,
          },
          LegalAnswerZ,
          {
            ...(overrideModel ? { model: overrideModel } : {}),
            temperature: 0,
            maxTokens: 2000,
            signal: opts.signal,
          },
        );
        if (!attempt.success || !attempt.data) {
          degraded = true;
          this.logger.warn(
            `[llm-detector] window ${i + 1}/${windows.length} failed validation; skipping`,
          );
          continue;
        }
        const parsed = normaliseLegalAnswer(attempt.data);
        aggregated.issues.push(...parsed.issues);
        aggregated.compliantElements.push(...parsed.compliantElements);
        aggregated.recommendations.push(...parsed.recommendations);
        aggregated.legislationReferenced.push(...parsed.legislationReferenced);
      } catch (err) {
        degraded = true;
        this.logger.warn(
          `[llm-detector] window ${i + 1}/${windows.length} threw: ${(err as Error).message}`,
        );
      }
    }

    return {
      issues: aggregated.issues,
      compliantElements: aggregated.compliantElements,
      recommendations: aggregated.recommendations,
      legislationReferenced: aggregated.legislationReferenced,
      status: degraded
        ? aggregated.issues.length > 0
          ? 'degraded'
          : 'failed'
        : 'succeeded',
      modelUsed: overrideModel ?? null,
      ...(degraded
        ? { errorMessage: 'one or more windows failed structured-output validation' }
        : {}),
    };
  }

  private buildUserPrompt(
    window: string,
    jurisdiction: string | null,
    idx: number,
    total: number,
  ): string {
    const juris = jurisdiction ? `Jurisdiction: ${jurisdiction}\n` : '';
    return `${juris}Window ${idx} of ${total}.\n\n=== CONTRACT EXCERPT ===\n${window}\n=== END ===`;
  }

  private windowText(text: string): string[] {
    if (text.length <= MAX_WINDOW_CHARS) return [text];
    const out: string[] = [];
    let start = 0;
    while (start < text.length) {
      const end = Math.min(start + MAX_WINDOW_CHARS, text.length);
      out.push(text.slice(start, end));
      if (end >= text.length) break;
      start = end - WINDOW_OVERLAP;
    }
    return out;
  }
}
