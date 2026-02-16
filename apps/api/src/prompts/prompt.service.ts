import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Prompt } from '../entities/prompt.entity';
import { RedlinePlaybook } from '@contractai-review/shared';

/** Known prompt keys for admin UI */
export const PROMPT_KEYS = [
  'chat.system',
  'chat.user',
  'redline.system',
  'redline.user',
  'redline.playbook.balanced',
  'redline.playbook.conservative',
  'redline.playbook.client-friendly',
] as const;

/** Built-in defaults when DB prompt is missing */
const DEFAULT_PROMPTS: Record<string, string> = {
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

@Injectable()
export class PromptService {
  private readonly languageMap: Record<string, string> = {
    en: 'English',
    es: 'Spanish',
    'pt-BR': 'Portuguese (Brazil)',
    pt: 'Portuguese',
    de: 'German',
  };

  constructor(
    @InjectRepository(Prompt)
    private promptRepository: Repository<Prompt>,
  ) {}

  /**
   * Get prompt content from DB (workspace override first, then global), fallback to built-in default.
   */
  async getPrompt(
    key: string,
    options?: { workspaceId?: string; variant?: string },
  ): Promise<string> {
    const variant = options?.variant ?? 'default';
    const workspaceId = options?.workspaceId ?? null;

    // Try workspace-specific first (if workspaceId provided)
    if (workspaceId) {
      const workspacePrompt = await this.promptRepository.findOne({
        where: { key, variant, workspaceId },
      });
      if (workspacePrompt) {
        return workspacePrompt.content;
      }
    }

    // Try global prompt
    const globalPrompt = await this.promptRepository.findOne({
      where: { key, variant, workspaceId: IsNull() },
    });
    if (globalPrompt) {
      return globalPrompt.content;
    }

    // Fallback to built-in default
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
    return this.languageMap[languageCode] || 'English';
  }

  /**
   * Get chat prompts (system + user) for RAG.
   */
  async getChatPrompts(
    params: ChatPromptParams,
    options?: { workspaceId?: string; variant?: string },
  ): Promise<{ system: string; user: string }> {
    const [system, userTemplate] = await Promise.all([
      this.getPrompt('chat.system', options),
      this.getPrompt('chat.user', options),
    ]);

    const user = this.interpolate(userTemplate, {
      languageName: params.languageName,
      context: params.context || 'No relevant context found.',
      question: params.question,
    });

    return { system, user };
  }

  /**
   * Get redline prompts (system + user) for redline generation.
   */
  async getRedlinePrompts(
    params: RedlinePromptParams,
    options?: { workspaceId?: string; variant?: string },
  ): Promise<{ system: string; user: string }> {
    const [system, userTemplate] = await Promise.all([
      this.getPrompt('redline.system', options),
      this.getPrompt('redline.user', options),
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
   * Get playbook-specific prompt content.
   */
  async getPlaybookPrompt(
    playbook: RedlinePlaybook,
    options?: { workspaceId?: string; variant?: string },
  ): Promise<string> {
    const keyMap: Record<RedlinePlaybook, string> = {
      [RedlinePlaybook.BALANCED]: 'redline.playbook.balanced',
      [RedlinePlaybook.CONSERVATIVE]: 'redline.playbook.conservative',
      [RedlinePlaybook.CLIENT_FRIENDLY]: 'redline.playbook.client-friendly',
    };
    const key = keyMap[playbook] ?? 'redline.playbook.balanced';
    return this.getPrompt(key, options);
  }

  /**
   * List all prompts for a workspace (workspace overrides + global defaults).
   */
  async listPromptsForWorkspace(workspaceId: string): Promise<
    Array<{
      key: string;
      content: string;
      source: 'workspace' | 'global';
      description?: string;
      updatedAt?: Date;
    }>
  > {
    const results: Array<{
      key: string;
      content: string;
      source: 'workspace' | 'global';
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
      const workspacePrompt = await this.promptRepository.findOne({
        where: { key, variant: 'default', workspaceId },
      });
      const globalPrompt = await this.promptRepository.findOne({
        where: { key, variant: 'default', workspaceId: IsNull() },
      });

      if (workspacePrompt) {
        results.push({
          key,
          content: workspacePrompt.content,
          source: 'workspace',
          description: descriptions[key] ?? (workspacePrompt.metadata as { description?: string })?.description,
          updatedAt: workspacePrompt.updatedAt,
        });
      } else if (globalPrompt) {
        results.push({
          key,
          content: globalPrompt.content,
          source: 'global',
          description: descriptions[key] ?? (globalPrompt.metadata as { description?: string })?.description,
          updatedAt: globalPrompt.updatedAt,
        });
      } else {
        const defaultContent = DEFAULT_PROMPTS[key];
        if (defaultContent) {
          results.push({
            key,
            content: defaultContent,
            source: 'global',
            description: descriptions[key],
          });
        }
      }
    }

    return results;
  }

  /**
   * Reset workspace prompt to global default (delete workspace override).
   */
  async resetPrompt(workspaceId: string, key: string): Promise<void> {
    const prompt = await this.promptRepository.findOne({
      where: { key, variant: 'default', workspaceId },
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
    options?: { workspaceId?: string; variant?: string; metadata?: Record<string, unknown> },
  ): Promise<Prompt> {
    const variant = options?.variant ?? 'default';
    const workspaceId = options?.workspaceId ?? undefined;

    let prompt = await this.promptRepository.findOne({
      where: workspaceId
        ? { key, variant, workspaceId }
        : { key, variant, workspaceId: IsNull() },
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
        content,
        metadata: options?.metadata ?? null,
      });
    }

    return this.promptRepository.save(prompt);
  }
}
