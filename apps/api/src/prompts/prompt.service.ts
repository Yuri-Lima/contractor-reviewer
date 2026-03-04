import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Prompt } from '../entities/prompt.entity';
import {
  RedlinePlaybook,
  getLanguageDisplayName,
  PROMPT_KEYS,
  GLOBAL_PROMPT_KEY,
  WORKSPACE_PROMPT_KEY,
} from '@contractai-review/shared';

export { PROMPT_KEYS, GLOBAL_PROMPT_KEY, WORKSPACE_PROMPT_KEY };

/** Built-in defaults when DB prompt is missing */
const DEFAULT_PROMPTS: Record<string, string> = {
  [GLOBAL_PROMPT_KEY]:
    'You are a legal assistant. Provide accurate, evidence-based answers. Always cite your sources. When a language is specified, provide all answers in that language.',
  [WORKSPACE_PROMPT_KEY]: '',
  'chat.system':
    'You are a legal assistant. Provide accurate, evidence-based answers. Always cite your sources. IMPORTANT: When a language is specified, provide all answers in that language.',
  'chat.user': `You are a legal assistant analyzing contracts. Answer the question based ONLY on the provided context. If the context doesn't contain enough information, say "NOT FOUND" and suggest where to look.

IMPORTANT: You MUST provide your answer in {{languageName}}. All responses must be written in {{languageName}}.

Context:
{{context}}

Question: {{question}}

Answer (be concise and cite specific excerpts, respond in {{languageName}}):`,
  'redline.system':
    'You are a legal assistant. Provide structured, evidence-based contract revisions. Always use conditional language and cite sources. Never provide legal advice. IMPORTANT: When a language is specified, provide all explanations in that language.',
  'redline.user': `You are a legal assistant helping to revise contract clauses. Your task is to suggest improvements to the selected text while maintaining legal accuracy and professional tone.

IMPORTANT: You MUST provide all responses, especially the "explanation" field, in {{languageName}}. All explanations, suggestions, and comments must be written in {{languageName}}.

{{playbookPrompt}}

Selected Text to Revise:
"{{selectedText}}"

Context from Contract and Legal Sources:
{{context}}

{{objective}}{{instructions}}

IMPORTANT RULES:
- NEVER say "this is illegal", "you must", or "you should"
- ALWAYS use conditional language ("may", "could", "depending on", "consider")
- NEVER provide legal advice or make absolute statements
- ALWAYS cite specific excerpts from the contract or legal sources
- If you cannot find sufficient evidence, respond with "NOT FOUND" and explain what was searched
- RESPOND IN {{languageName}}: All explanations must be in {{languageName}}

Please provide:
1. A revised version of the selected text (suggestedText) - keep original language of the contract
2. A clear explanation of why the change was suggested (explanation) - MUST be in {{languageName}}
3. Specific citations from the contract (citations)
4. Legal citations if relevant (legalCitations)

Format your response as JSON:
{
  "suggestedText": "...",
  "explanation": "...",
  "citations": [
    {
      "kind": "contract",
      "file": "...",
      "page": 12,
      "spanId": "...",
      "quoteSnippet": "..."
    }
  ],
  "legalCitations": [
    {
      "kind": "legal",
      "source": "...",
      "section": "...",
      "url": "..."
    }
  ]
}`,
  'redline.playbook.balanced': `Playbook: BALANCED
- Balance risks and benefits for all parties
- Use neutral, professional language
- Suggest improvements that enhance clarity and fairness
- Consider both parties' interests equally`,
  'redline.playbook.conservative': `Playbook: CONSERVATIVE
- Minimize changes to the original text
- Focus on clarity and precision
- Use neutral, professional language
- Only suggest changes that improve clarity without changing meaning
- Avoid favoritism toward any party`,
  'redline.playbook.client-friendly': `Playbook: CLIENT_FRIENDLY
- Suggest changes that are more favorable to the client/user
- However, remain professional and defensible
- Avoid extreme language or absolute guarantees
- Ensure suggestions are plausible and reasonable
- Balance client interests with legal soundness`,
};

export interface ChatPromptParams {
  languageName: string;
  context: string;
  question: string;
}

export interface RedlinePromptParams {
  languageName: string;
  playbookPrompt: string;
  selectedText: string;
  context: string;
  objective: string;
  instructions: string;
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
   * For system keys (chat.system, redline.system): global.system + workspace.system + document key.
   * For other keys (chat.user, redline.user, playbooks): document key only.
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

    const isSystemKey = key === 'chat.system' || key === 'redline.system';

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

    const defaultContent = DEFAULT_PROMPTS[key];
    if (defaultContent !== undefined) return defaultContent;
    throw new Error(`Prompt not found: ${key} (no default available)`);
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
    const defaultContent = DEFAULT_PROMPTS[key];
    if (defaultContent) {
      return defaultContent;
    }

    throw new Error(`Prompt not found: ${key} (no default available)`);
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

    const user = this.interpolate(userTemplate, {
      languageName: params.languageName,
      context: params.context || 'No relevant context found.',
      question: params.question,
    });

    return { system, user };
  }

  /**
   * Get redline prompts (system + user) for redline generation. Uses additive combination when scopeFlags provided.
   */
  async getRedlinePrompts(
    params: RedlinePromptParams,
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
        ? this.getCombinedPrompt('redline.system', options)
        : this.getPrompt('redline.system', options),
      useCombined
        ? this.getCombinedPrompt('redline.user', options)
        : this.getPrompt('redline.user', options),
    ]);

    const user = this.interpolate(userTemplate, {
      languageName: params.languageName,
      playbookPrompt: params.playbookPrompt,
      selectedText: params.selectedText,
      context: params.context || 'No additional context available.',
      objective: params.objective ? `\n\nObjective: ${params.objective}` : '',
      instructions: params.instructions ? `\n\nAdditional Instructions: ${params.instructions}` : '',
    });

    return { system, user };
  }

  /**
   * Get playbook-specific prompt content. Uses additive combination when scopeFlags provided.
   */
  async getPlaybookPrompt(
    playbook: RedlinePlaybook,
    options?: {
      workspaceId?: string;
      documentId?: string;
      variant?: string;
      scopeFlags?: PromptScopeFlags;
    },
  ): Promise<string> {
    const keyMap: Record<RedlinePlaybook, string> = {
      [RedlinePlaybook.BALANCED]: 'redline.playbook.balanced',
      [RedlinePlaybook.CONSERVATIVE]: 'redline.playbook.conservative',
      [RedlinePlaybook.CLIENT_FRIENDLY]: 'redline.playbook.client-friendly',
    };
    const key = keyMap[playbook] ?? 'redline.playbook.balanced';
    return options?.scopeFlags != null
      ? this.getCombinedPrompt(key, options)
      : this.getPrompt(key, options);
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
    const content = workspacePrompt?.content ?? DEFAULT_PROMPTS[WORKSPACE_PROMPT_KEY] ?? '';
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
    const content = globalPrompt?.content ?? DEFAULT_PROMPTS[GLOBAL_PROMPT_KEY] ?? '';
    return [
      {
        key: GLOBAL_PROMPT_KEY,
        content,
        source: 'global' as const,
        hasOverride: !!globalPrompt,
        description: 'Global system prompt for all chat and redline',
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
      'redline.system': 'System prompt for redline generation',
      'redline.user': 'User prompt template for redline',
      'redline.playbook.balanced': 'Balanced redline playbook',
      'redline.playbook.conservative': 'Conservative redline playbook',
      'redline.playbook.client-friendly': 'Client-friendly redline playbook',
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
          : documentPrompt?.content ?? workspacePrompt?.content ?? globalPrompt?.content ?? DEFAULT_PROMPTS[key];
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
