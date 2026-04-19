export const ONBOARDING_VERSION = 1;

export const CHECKLIST_KEYS = [
  'create_workspace',
  'upload_contract',
  'run_first_review',
  'export_document',
] as const;

export type ChecklistKey = (typeof CHECKLIST_KEYS)[number];

export const ROUTE_GUIDE_KEYS = [
  'documents_list',
  'workspace_settings',
  'members',
  'privacy',
  'audit',
  'account_settings',
] as const;

export type RouteGuideKey = (typeof ROUTE_GUIDE_KEYS)[number];
