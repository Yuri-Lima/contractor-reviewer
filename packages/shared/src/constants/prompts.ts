import type { PromptSource } from '../types/prompts';

/** Single global prompt key (Account level) */
export const GLOBAL_PROMPT_KEY = 'global.system' as const;

/** Single workspace prompt key (Workspace level) */
export const WORKSPACE_PROMPT_KEY = 'workspace.system' as const;

/** Document-level prompt keys used for RAG chat and redline. Single source of truth. */
export const PROMPT_KEYS = [
  'chat.system',
  'chat.user',
  'redline.system',
  'redline.user',
  'redline.playbook.balanced',
  'redline.playbook.conservative',
  'redline.playbook.client-friendly',
] as const;

/** Document prompt key type */
export type DocumentPromptKey = (typeof PROMPT_KEYS)[number];

/** Maps prompt key to i18n translation key for UI labels. Single source of truth. */
export const PROMPT_LABEL_KEYS: Record<string, string> = {
  [GLOBAL_PROMPT_KEY]: 'prompts.globalSystemPrompt',
  [WORKSPACE_PROMPT_KEY]: 'prompts.workspaceSystemPrompt',
  'chat.system': 'prompts.chatSystem',
  'chat.user': 'prompts.chatUser',
  'redline.system': 'prompts.redlineSystem',
  'redline.user': 'prompts.redlineUser',
  'redline.playbook.balanced': 'prompts.playbookBalanced',
  'redline.playbook.conservative': 'prompts.playbookConservative',
  'redline.playbook.client-friendly': 'prompts.playbookClientFriendly',
};

/** Maps prompt source to i18n translation key for UI labels. */
export const PROMPT_SOURCE_LABEL_KEYS: Record<PromptSource, string> = {
  document: 'prompts.sourceDocument',
  workspace: 'prompts.sourceWorkspace',
  global: 'prompts.sourceGlobal',
};
