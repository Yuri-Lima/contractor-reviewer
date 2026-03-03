import type { PromptSource } from '../types/prompts';

/** Prompt keys used for RAG chat and redline. Single source of truth for valid keys. */
export const PROMPT_KEYS = [
  'chat.system',
  'chat.user',
  'redline.system',
  'redline.user',
  'redline.playbook.balanced',
  'redline.playbook.conservative',
  'redline.playbook.client-friendly',
] as const;

/** Maps prompt key to i18n translation key for UI labels. Single source of truth. */
export const PROMPT_LABEL_KEYS: Record<string, string> = {
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
