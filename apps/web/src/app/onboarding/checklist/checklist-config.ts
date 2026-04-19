import { CHECKLIST_KEYS } from '@contractai-review/shared';
import type { ChecklistKey } from '@contractai-review/shared';
import { ROUTES } from '../../core/routes';

export interface ChecklistItemConfig {
  key: ChecklistKey;
  titleKey: string;
  route?: string;
}

const KEY_TO_TITLE: Record<string, string> = {
  create_workspace: 'onboarding.checklist.createWorkspace',
  upload_contract: 'onboarding.checklist.uploadContract',
  run_first_review: 'onboarding.checklist.runFirstReview',
  export_document: 'onboarding.checklist.exportDocument',
};

export const CHECKLIST_CONFIG: ChecklistItemConfig[] = CHECKLIST_KEYS.map((key) => ({
  key,
  titleKey: KEY_TO_TITLE[key],
  route: key === 'create_workspace' ? ROUTES.WORKSPACES : undefined,
}));
