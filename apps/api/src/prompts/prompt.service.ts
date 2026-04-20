import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Prompt } from '../entities/prompt.entity';
import {
  getLanguageDisplayName,
  PROMPT_KEYS,
  GLOBAL_PROMPT_KEY,
  WORKSPACE_PROMPT_KEY,
} from '@contractai-review/shared';

export { PROMPT_KEYS, GLOBAL_PROMPT_KEY, WORKSPACE_PROMPT_KEY };

/**
 * Variant identifier for the legal-grade structured-output prompts (Phase 1
 * of legal-review pipeline). When `LEGAL_REVIEW_MODE` is on, RAG passes
 * `variant: LEGAL_REVIEW_PROMPT_VARIANT` to `getChatPrompts`.
 */
export const LEGAL_REVIEW_PROMPT_VARIANT = 'legal-review-v2';

/**
 * Built-in defaults when DB prompt is missing. Keyed by `${variant}::${key}`,
 * with a fallback to `default::${key}` when the variant lookup misses.
 *
 * The `legal-review-v2` variant is the structured-output prompt pair that
 * forces the LLM to emit `LegalAnswer` JSON with clause-level citations,
 * named statutes, severity-tagged issues, and calibrated confidence.
 */
const DEFAULT_PROMPTS: Record<string, string> = {
  // ---- default variant (legacy free-text path) ----
  [`default::${GLOBAL_PROMPT_KEY}`]:
    'You are a legal assistant. Provide accurate, evidence-based answers. Always cite your sources. When a language is specified, provide all answers in that language.',
  [`default::${WORKSPACE_PROMPT_KEY}`]: '',
  'default::chat.system':
    'You are a legal assistant. Provide accurate, evidence-based answers. Always cite your sources. IMPORTANT: When a language is specified, provide all answers in that language.',
  'default::chat.user': `You are a legal assistant analyzing contracts. Answer the question based ONLY on the provided context. If the context doesn't contain enough information, say "NOT FOUND" and suggest where to look.

IMPORTANT: You MUST provide your answer in {{languageName}}. All responses must be written in {{languageName}}.

{{conversationHistory}}

Context:
{{context}}

Question: {{question}}

Answer (be concise and cite specific excerpts, respond in {{languageName}}):`,

  // ---- legal-review-v2 variant (structured-output path) ----
  // Re-uses the same global/workspace defaults — the structured shape is enforced by the user template + provider-side JSON schema.
  [`${LEGAL_REVIEW_PROMPT_VARIANT}::${GLOBAL_PROMPT_KEY}`]:
    'You are a senior legal counsel reviewing a contract clause-by-clause. You answer in JSON only and cite by clause number and named statute. Do not invent legislation or clause numbers.',
  [`${LEGAL_REVIEW_PROMPT_VARIANT}::${WORKSPACE_PROMPT_KEY}`]: '',
  [`${LEGAL_REVIEW_PROMPT_VARIANT}::chat.system`]: `You are a senior legal counsel reviewing contracts.

You produce a single JSON object that exactly matches the "LegalAnswer" schema enforced by the LLM provider. Do not include any prose, markdown, code fences or commentary outside the JSON.

CITATION RULES
- Whenever an excerpt is labelled "[Clause X.Y.Z]:" you MUST set issues[].clauseRef and compliantElements[].clauseRef to that exact clause number (e.g. "9.1.3"). When only "[Excerpt N]:" is available, omit clauseRef rather than fabricate one.
- legislationReferenced[] MUST only contain statutes that appear in the "Legal sources" block of the user message. Use the act name + year + section EXACTLY as listed there. Never invent statute names, years, or sections. If no Legal sources block is provided, leave legislationReferenced as [].
- Apply the same rule to issues[].legislationRef.

WHAT TO LOOK FOR (always populate BOTH compliantElements and issues — never one-sided when the question is about compliance)
- Compliance: clauses that meet or fail jurisdictional requirements.
- Drafting: literal "OR" between options, "[XX]", "[four]", "tbc", "XX day of XX", "three/six month" slashes, blank "[ ]".
- Terminology: jurisdiction-mismatched terms (e.g. UK "qualifying earnings" inside an Irish contract, or "statutory minimum required by Irish law" inside an occupational-scheme block).
- Missing-clause: required obligations the contract omits for the stated jurisdiction.
- Deprecated: outdated statute names, repealed thresholds.
- Ambiguity: clauses whose plain meaning is genuinely unclear.

SEVERITY
- blocker: makes the contract unsignable as drafted (template artefact, contradictory clauses).
- high: likely unenforceable or non-compliant; needs redraft before signature.
- medium: should be fixed but not signing-blocking.
- low: stylistic or minor.
- info: observation, not a defect.

CONFIDENCE CALIBRATION (must follow exactly)
- "high"   = at least one named statute matched AND at least one clauseRef cited AND no internal contradictions in your output.
- "medium" = at least one clauseRef cited but NO named statute matched, OR statute matched but no clauseRef.
- "low"    = neither clauseRef nor statute could be cited, OR you had to fall back on general knowledge.

LANGUAGE
- All free-text fields (rationale, message, suggestion, recommendations, freeText) MUST be written in {{languageName}}. Schema enum values (severity, category, confidence) stay in English.

OUTPUT
- Return a single JSON object matching the LegalAnswer schema. No surrounding text. The provider will reject anything that does not match the schema.`,

  [`${LEGAL_REVIEW_PROMPT_VARIANT}::chat.user`]: `Question (jurisdiction = {{jurisdiction}}): {{question}}

Respond in {{languageName}}.

{{conversationHistory}}

Document excerpts (with clause numbers when available):
{{context}}

Legal sources (statutes for jurisdiction {{jurisdiction}} — use ONLY these for legislationReferenced and legislationRef):
{{legalSources}}

Return a single JSON object matching the LegalAnswer schema. No prose outside JSON.`,
};

function lookupDefault(key: string, variant: string): string | undefined {
  return DEFAULT_PROMPTS[`${variant}::${key}`] ?? DEFAULT_PROMPTS[`default::${key}`];
}

export interface ChatPromptParams {
  languageName: string;
  context: string;
  question: string;
  /** Optional conversation history for multi-turn (formatted as User: X\nAssistant: Y\n) */
  conversationHistory?: string;
  /** ISO-ish jurisdiction code (e.g. "IE"). Used by the legal-review-v2 variant. */
  jurisdiction?: string;
  /** Pre-formatted legal sources block (one entry per line). Used by the legal-review-v2 variant. */
  legalSources?: string;
}

/** Scope flags for additive prompt combination (user can enable/disable each layer) */
export interface PromptScopeFlags {
  includeGlobal?: boolean;
  includeWorkspace?: boolean;
  includeDocument?: boolean;
}

@Injectable()
export class PromptService {
  constructor(
    @InjectRepository(Prompt)
    private promptRepository: Repository<Prompt>,
  ) {}

  /**
   * Get combined prompt content (additive: global + workspace + document).
   * For system keys (chat.system): global.system + workspace.system + document key.
   * For other keys (chat.user): document key only.
   */
  async getCombinedPrompt(
    key: string,
    options?: {
      workspaceId?: string;
      documentId?: string;
      variant?: string;
      scopeFlags?: PromptScopeFlags;
    },
  ): Promise<string> {
    const variant = options?.variant ?? 'default';
    const workspaceId = options?.workspaceId ?? null;
    const documentId = options?.documentId ?? null;
    const flags = options?.scopeFlags ?? {};
    const includeGlobal = flags.includeGlobal !== false;
    const includeWorkspace = flags.includeWorkspace !== false;
    const includeDocument = flags.includeDocument !== false;

    const isSystemKey = key === 'chat.system';

    const [globalPrompt, workspacePrompt, documentPrompt] = await Promise.all([
      isSystemKey
        ? this.promptRepository.findOne({
            where: { key: GLOBAL_PROMPT_KEY, variant, workspaceId: IsNull(), documentId: IsNull() },
          })
        : Promise.resolve(null),
      isSystemKey && workspaceId
        ? this.promptRepository.findOne({
            where: { key: WORKSPACE_PROMPT_KEY, variant, workspaceId, documentId: IsNull() },
          })
        : Promise.resolve(null),
      documentId
        ? this.promptRepository.findOne({
            where: { key, variant, documentId },
          })
        : Promise.resolve(null),
    ]);

    const parts: string[] = [];
    if (isSystemKey && includeGlobal && globalPrompt?.content) {
      parts.push(globalPrompt.content);
    }
    if (isSystemKey && includeWorkspace && workspacePrompt?.content) {
      parts.push(workspacePrompt.content);
    }
    if (includeDocument && documentPrompt?.content) {
      parts.push(documentPrompt.content);
    }

    if (parts.length > 0) {
      return parts.join('\n\n');
    }

    const defaultContent = lookupDefault(key, variant);
    if (defaultContent !== undefined) return defaultContent;
    throw new Error(`Prompt not found: ${key} variant=${variant} (no default available)`);
  }

  /**
   * Get prompt content from DB (document → workspace → global), fallback to built-in default.
   * @deprecated Use getCombinedPrompt for additive behavior.
   */
  async getPrompt(
    key: string,
    options?: { workspaceId?: string; documentId?: string; variant?: string },
  ): Promise<string> {
    const variant = options?.variant ?? 'default';
    const workspaceId = options?.workspaceId ?? null;
    const documentId = options?.documentId ?? null;

    // 1. Try document-specific first
    if (documentId) {
      const documentPrompt = await this.promptRepository.findOne({
        where: { key, variant, documentId },
      });
      if (documentPrompt) {
        return documentPrompt.content;
      }
    }

    // 2. Try workspace-specific
    if (workspaceId) {
      const workspacePrompt = await this.promptRepository.findOne({
        where: { key, variant, workspaceId, documentId: IsNull() },
      });
      if (workspacePrompt) {
        return workspacePrompt.content;
      }
    }

    // 3. Try global prompt
    const globalPrompt = await this.promptRepository.findOne({
      where: { key, variant, workspaceId: IsNull(), documentId: IsNull() },
    });
    if (globalPrompt) {
      return globalPrompt.content;
    }

    // 4. Fallback to built-in default
    const defaultContent = lookupDefault(key, variant);
    if (defaultContent) {
      return defaultContent;
    }

    throw new Error(`Prompt not found: ${key} variant=${variant} (no default available)`);
  }

  /**
   * Interpolate template variables {{varName}} with values from params.
   */
  interpolate(template: string, params: Record<string, string>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      const value = params[key];
      return value !== undefined ? value : `{{${key}}}`;
    });
  }

  /**
   * Get language display name from code.
   */
  getLanguageName(languageCode: string): string {
    return getLanguageDisplayName(languageCode);
  }

  /**
   * Get chat prompts (system + user) for RAG. Uses additive combination when scopeFlags provided.
   */
  async getChatPrompts(
    params: ChatPromptParams,
    options?: {
      workspaceId?: string;
      documentId?: string;
      variant?: string;
      scopeFlags?: PromptScopeFlags;
    },
  ): Promise<{ system: string; user: string }> {
    const useCombined = options?.scopeFlags != null;
    const [system, userTemplate] = await Promise.all([
      useCombined
        ? this.getCombinedPrompt('chat.system', options)
        : this.getPrompt('chat.system', options),
      useCombined
        ? this.getCombinedPrompt('chat.user', options)
        : this.getPrompt('chat.user', options),
    ]);

    const conversationHistory = params.conversationHistory
      ? `Previous conversation:\n${params.conversationHistory}\n\n`
      : '';

    const user = this.interpolate(userTemplate, {
      languageName: params.languageName,
      context: params.context || 'No relevant context found.',
      question: params.question,
      conversationHistory,
      jurisdiction: params.jurisdiction || 'unknown',
      legalSources: params.legalSources || 'No statutes available for this jurisdiction.',
    });

    const interpolatedSystem = this.interpolate(system, {
      languageName: params.languageName,
      jurisdiction: params.jurisdiction || 'unknown',
    });

    return { system: interpolatedSystem, user };
  }

  /**
   * List workspace prompt (single item: workspace.system only).
   */
  async listPromptsForWorkspace(
    workspaceId: string,
    _scopeFlags?: { includeGlobal?: boolean; includeWorkspace?: boolean },
  ): Promise<
    Array<{
      key: string;
      content: string;
      source: 'workspace';
      hasOverride: boolean;
      description?: string;
      updatedAt?: Date;
    }>
  > {
    const workspacePrompt = await this.promptRepository.findOne({
      where: {
        key: WORKSPACE_PROMPT_KEY,
        variant: 'default',
        workspaceId,
        documentId: IsNull(),
      },
    });
    const content = workspacePrompt?.content ?? lookupDefault(WORKSPACE_PROMPT_KEY, 'default') ?? '';
    return [
      {
        key: WORKSPACE_PROMPT_KEY,
        content,
        source: 'workspace' as const,
        hasOverride: !!workspacePrompt,
        description: 'Workspace system prompt for all documents',
        updatedAt: workspacePrompt?.updatedAt,
      },
    ];
  }

  /**
   * List global prompt (single item: global.system only).
   */
  async listGlobalPrompts(): Promise<
    Array<{
      key: string;
      content: string;
      source: 'global';
      hasOverride: boolean;
      description?: string;
      updatedAt?: Date;
    }>
  > {
    const globalPrompt = await this.promptRepository.findOne({
      where: {
        key: GLOBAL_PROMPT_KEY,
        variant: 'default',
        workspaceId: IsNull(),
        documentId: IsNull(),
      },
    });
    const content = globalPrompt?.content ?? lookupDefault(GLOBAL_PROMPT_KEY, 'default') ?? '';
    return [
      {
        key: GLOBAL_PROMPT_KEY,
        content,
        source: 'global' as const,
        hasOverride: !!globalPrompt,
        description: 'Global system prompt for chat',
        updatedAt: globalPrompt?.updatedAt,
      },
    ];
  }

  /**
   * Upsert global prompt (workspaceId and documentId are null).
   */
  async upsertGlobalPrompt(key: string, content: string): Promise<Prompt> {
    return this.upsertPrompt(key, content, { variant: 'default' });
  }

  /**
   * Reset global prompt to built-in default (delete global override).
   */
  async resetGlobalPrompt(key: string): Promise<void> {
    const prompt = await this.promptRepository.findOne({
      where: { key, variant: 'default', workspaceId: IsNull(), documentId: IsNull() },
    });
    if (prompt) {
      await this.promptRepository.remove(prompt);
    }
  }

  /**
   * Reset workspace prompt to global default (delete workspace override).
   */
  async resetPrompt(workspaceId: string, key: string): Promise<void> {
    const prompt = await this.promptRepository.findOne({
      where: { key, variant: 'default', workspaceId, documentId: IsNull() },
    });
    if (prompt) {
      await this.promptRepository.remove(prompt);
    }
  }

  /**
   * List all prompts for a document. Returns combined content when scopeFlags provided.
   */
  async listPromptsForDocument(
    workspaceId: string,
    documentId: string,
    scopeFlags?: PromptScopeFlags,
  ): Promise<
    Array<{
      key: string;
      content: string;
      source: 'document' | 'workspace' | 'global';
      description?: string;
      updatedAt?: Date;
    }>
  > {
    const results: Array<{
      key: string;
      content: string;
      source: 'document' | 'workspace' | 'global';
      description?: string;
      updatedAt?: Date;
    }> = [];

    const descriptions: Record<string, string> = {
      'chat.system': 'System prompt for RAG chat',
      'chat.user': 'User prompt template for RAG chat',
    };

    for (const key of PROMPT_KEYS) {
      const documentPrompt = await this.promptRepository.findOne({
        where: { key, variant: 'default', documentId },
      });
      const workspacePrompt = await this.promptRepository.findOne({
        where: { key, variant: 'default', workspaceId, documentId: IsNull() },
      });
      const globalPrompt = await this.promptRepository.findOne({
        where: { key, variant: 'default', workspaceId: IsNull(), documentId: IsNull() },
      });

      const content =
        scopeFlags != null
          ? await this.getCombinedPrompt(key, {
              workspaceId,
              documentId,
              variant: 'default',
              scopeFlags,
            })
          : documentPrompt?.content ?? workspacePrompt?.content ?? globalPrompt?.content ?? lookupDefault(key, 'default');
      if (!content) continue;

      const source = documentPrompt ? 'document' : workspacePrompt ? 'workspace' : 'global';
      const meta = (documentPrompt ?? workspacePrompt ?? globalPrompt)?.metadata as { description?: string } | undefined;
      results.push({
        key,
        content,
        source,
        description: descriptions[key] ?? meta?.description,
        updatedAt: (documentPrompt ?? workspacePrompt ?? globalPrompt)?.updatedAt,
      });
    }

    return results;
  }

  /**
   * Reset document prompt to workspace/global (delete document override).
   */
  async resetDocumentPrompt(workspaceId: string, documentId: string, key: string): Promise<void> {
    const prompt = await this.promptRepository.findOne({
      where: { key, variant: 'default', documentId },
    });
    if (prompt) {
      await this.promptRepository.remove(prompt);
    }
  }

  /**
   * Update or create a prompt (for admin/runtime tuning).
   */
  async upsertPrompt(
    key: string,
    content: string,
    options?: {
      workspaceId?: string;
      documentId?: string;
      variant?: string;
      metadata?: Record<string, unknown>;
    },
  ): Promise<Prompt> {
    const variant = options?.variant ?? 'default';
    const workspaceId = options?.workspaceId ?? undefined;
    const documentId = options?.documentId ?? undefined;

    if (documentId && workspaceId) {
      let prompt = await this.promptRepository.findOne({
        where: { key, variant, documentId },
      });
      if (prompt) {
        prompt.content = content;
        if (options?.metadata !== undefined) {
          prompt.metadata = options.metadata;
        }
      } else {
        prompt = this.promptRepository.create({
          key,
          variant,
          workspaceId,
          documentId,
          content,
          metadata: options?.metadata ?? null,
        });
      }
      return this.promptRepository.save(prompt);
    }

    let prompt = await this.promptRepository.findOne({
      where:
        workspaceId !== undefined
          ? { key, variant, workspaceId, documentId: IsNull() }
          : { key, variant, workspaceId: IsNull(), documentId: IsNull() },
    });

    if (prompt) {
      prompt.content = content;
      if (options?.metadata !== undefined) {
        prompt.metadata = options.metadata;
      }
    } else {
      prompt = this.promptRepository.create({
        key,
        variant,
        workspaceId: workspaceId ?? null,
        documentId: null,
        content,
        metadata: options?.metadata ?? null,
      });
    }

    return this.promptRepository.save(prompt);
  }
}
