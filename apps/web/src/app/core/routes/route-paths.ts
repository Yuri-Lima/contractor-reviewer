/**
 * Single source of truth for route paths.
 * Use these constants instead of hardcoded strings for routerLink, navigate(), and Route config.
 */

/** Full path constants for routerLink, redirectTo, and router.navigate() */
export const ROUTES = {
  LOGIN: '/login',
  REGISTER: '/register',
  SETTINGS: '/settings',
  WORKSPACES: '/workspaces',
} as const;

/** Path segments for Angular Route config (path property) - no leading slash */
export const ROUTE_PATHS = {
  LOGIN: 'login',
  REGISTER: 'register',
  SETTINGS: 'settings',
  WORKSPACES: 'workspaces',
  WORKSPACE_ID: ':workspaceId',
  DOCUMENTS: 'documents',
  DOCUMENT_ID: ':documentId',
  PRIVACY: 'privacy',
  AUDIT: 'audit',
  MEMBERS: 'members',
} as const;

/** Helper to build workspace-scoped routes (for routerLink array) */
export function workspaceRoute(workspaceId: string, segment: string): readonly [string, string, string] {
  return [ROUTES.WORKSPACES, workspaceId, segment] as const;
}

export function workspaceDocuments(workspaceId: string): readonly [string, string, string] {
  return workspaceRoute(workspaceId, ROUTE_PATHS.DOCUMENTS);
}

export function workspaceDocument(workspaceId: string, documentId: string): readonly [string, string, string, string] {
  return [ROUTES.WORKSPACES, workspaceId, ROUTE_PATHS.DOCUMENTS, documentId] as const;
}

export function workspacePrivacy(workspaceId: string): readonly [string, string, string] {
  return workspaceRoute(workspaceId, ROUTE_PATHS.PRIVACY);
}

export function workspaceAudit(workspaceId: string): readonly [string, string, string] {
  return workspaceRoute(workspaceId, ROUTE_PATHS.AUDIT);
}

export function workspaceMembers(workspaceId: string): readonly [string, string, string] {
  return workspaceRoute(workspaceId, ROUTE_PATHS.MEMBERS);
}

export function workspaceSettings(workspaceId: string): readonly [string, string, string] {
  return workspaceRoute(workspaceId, ROUTE_PATHS.SETTINGS);
}

/** Helper to build document settings route (workspaces/:workspaceId/documents/:documentId/settings) */
export function documentSettings(workspaceId: string, documentId: string): readonly [string, string, string, string, string] {
  return [ROUTES.WORKSPACES, workspaceId, ROUTE_PATHS.DOCUMENTS, documentId, ROUTE_PATHS.SETTINGS] as const;
}
