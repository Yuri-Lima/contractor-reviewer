/** Prompt source scope: document override, workspace override, or global default */
export type PromptSource = 'document' | 'workspace' | 'global';

export interface PromptListItem {
  key: string;
  content: string;
  source: PromptSource;
  description?: string;
  updatedAt?: string;
}

export interface PromptResponse extends PromptListItem {
  updatedAt?: string;
}

export interface ListPromptsResponse {
  prompts: PromptListItem[];
}
