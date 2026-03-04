import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenAI } from 'openai';

export type PromptGeneratorTarget = 'document' | 'workspace';

export interface GeneratePromptParams {
  target: PromptGeneratorTarget;
  title: string;
  description: string;
  contextMarkdown?: string;
  useCase?: string;
}

const META_PROMPTS: Record<PromptGeneratorTarget, string> = {
  document: `You are generating document-specific instructions for a legal contract analysis assistant.
Given a document title and description (and optionally additional context in markdown), produce concise instructions that will be ADDED to the assistant's system prompt when analyzing this document.

Rules:
- Output ONLY the instructions text. No preamble, no meta-commentary.
- Use evidence-based language. Focus on document type, key areas of attention, jurisdiction hints if inferable.
- If additional context (markdown) is provided, use it to enrich your understanding of the document — do not reproduce the context verbatim; extract and summarize relevant guidance.
- Match the language of the description when possible (EN/ES/PT).
- Keep under 300 words.
- Do not duplicate generic legal assistant instructions (e.g. "always cite sources").
- Be specific to this document's context.`,
  workspace: `You are generating workspace-specific instructions for a legal contract analysis assistant.
Given a workspace context (name, description), produce concise instructions that will be ADDED to the assistant's system prompt for this workspace.

Rules:
- Output ONLY the instructions text. No preamble, no meta-commentary.
- Use evidence-based language. Focus on workspace scope, typical document types, jurisdiction preferences.
- Match the language of the description when possible (EN/ES/PT).
- Keep under 300 words.
- Be specific to this workspace's context.`,
};

const DEFAULT_TIMEOUT_MS = 60_000;

@Injectable()
export class PromptGeneratorService {
  private readonly openaiClient: OpenAI;
  private readonly chatModel: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      console.warn('OPENAI_API_KEY not set - prompt generation will fail');
    }
    this.openaiClient = new OpenAI({ apiKey: apiKey || 'dummy-key' });
    this.chatModel =
      this.configService.get<string>('OPENAI_CHAT_MODEL') || 'gpt-4o-mini';
  }

  async generate(
    params: GeneratePromptParams,
    options?: { signal?: AbortSignal },
  ): Promise<string> {
    const metaPrompt = META_PROMPTS[params.target];
    if (!metaPrompt) {
      throw new Error(`Unknown prompt generator target: ${params.target}`);
    }

    let userMessage = `Document title: ${params.title}\n\nDescription: ${params.description}`;
    if (params.contextMarkdown?.trim()) {
      userMessage += `\n\nAdditional context (markdown):\n${params.contextMarkdown.trim()}`;
    }

    const signal = options?.signal ?? this.createTimeoutSignal(DEFAULT_TIMEOUT_MS);

    const response = await this.openaiClient.chat.completions.create(
      {
        model: this.chatModel,
        messages: [
          { role: 'system', content: metaPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.5,
        max_tokens: 500,
      },
      { signal },
    );

    const content = response.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new Error('Empty response from OpenAI');
    }
    return content;
  }

  private createTimeoutSignal(ms: number): AbortSignal {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), ms);
    return controller.signal;
  }
}
