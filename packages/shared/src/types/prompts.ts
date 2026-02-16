export interface PromptListItem {
  key: string;
  content: string;
  source: 'workspace' | 'global';
  description?: string;
  updatedAt?: string;
}

export interface PromptResponse extends PromptListItem {
  updatedAt?: string;
}

export interface ListPromptsResponse {
  prompts: PromptListItem[];
}
