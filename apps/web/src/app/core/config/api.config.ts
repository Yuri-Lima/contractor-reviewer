import { environment } from '../../../environments/environment';

export const API_CONFIG = {
  baseUrl: environment.apiUrl,
  endpoints: {
    auth: {
      login: '/auth/login',
      register: '/auth/register',
      logout: '/auth/logout',
    },
    users: {
      search: '/auth/users/search',
    },
    account: '/account',
    workspaces: '/workspaces',
    documents: (workspaceId: string) => `/workspaces/${workspaceId}/documents`,
    chat: (workspaceId: string, documentId: string) => `/workspaces/${workspaceId}/documents/${documentId}/chat`,
    redline: (workspaceId: string, documentId: string) => `/workspaces/${workspaceId}/documents/${documentId}/redline`,
    privacy: (workspaceId: string) => `/workspaces/${workspaceId}/privacy`,
    audit: (workspaceId: string) => `/workspaces/${workspaceId}/audit`,
    retention: (workspaceId: string) => `/workspaces/${workspaceId}/retention`,
  },
};
