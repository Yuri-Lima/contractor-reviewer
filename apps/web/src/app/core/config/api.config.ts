import { environment } from '../../../environments/environment';
import { Capacitor } from '@capacitor/core';

/**
 * Get the API base URL based on the current platform
 * - Web: Uses environment.apiUrl (typically localhost:3000/api)
 * - Mobile (Capacitor): Detects if running on device/emulator and adjusts URL
 *   - Physical devices: Uses the computer's local IP (must be on same network)
 *   - Emulators: Can use localhost or special addresses
 */
function getWsUrl(): string {
  if (typeof window === 'undefined') return '';
  if (Capacitor.isNativePlatform()) {
    let apiUrl = environment.apiUrl;
    if (Capacitor.getPlatform() === 'android' && (apiUrl.includes('localhost') || apiUrl.includes('127.0.0.1'))) {
      apiUrl = apiUrl.replace('localhost', '10.0.2.2').replace('127.0.0.1', '10.0.2.2');
    }
    try {
      const u = new URL(apiUrl);
      u.port = '3200';
      u.pathname = '';
      u.search = '';
      return u.toString();
    } catch {
      return apiUrl.replace(/\/api\/?$/, '').replace(/:3000/, ':3200');
    }
  }
  if (environment.production) {
    return window.location.origin;
  }
  try {
    const u = new URL(environment.apiUrl);
    u.port = '3200';
    u.pathname = '';
    u.search = '';
    return u.toString();
  } catch {
    return 'http://localhost:3200';
  }
}

function getApiBaseUrl(): string {
  // Check if running in Capacitor
  if (Capacitor.isNativePlatform()) {
    const platform = Capacitor.getPlatform();
    
    // For iOS simulator, localhost works
    if (platform === 'ios') {
      // iOS simulator can use localhost
      // For physical devices, update environment.ts with your computer's IP
      // Example: apiUrl: 'http://192.168.1.100:3000/api'
      return environment.apiUrl;
    }
    
    // For Android emulator, use 10.0.2.2 instead of localhost
    if (platform === 'android') {
      const apiUrl = environment.apiUrl;
      if (apiUrl.includes('localhost') || apiUrl.includes('127.0.0.1')) {
        // Android emulator special address
        return apiUrl.replace('localhost', '10.0.2.2').replace('127.0.0.1', '10.0.2.2');
      }
      return apiUrl;
    }
  }
  
  // Web platform - use environment as-is
  return environment.apiUrl;
}

export const API_CONFIG = {
  baseUrl: getApiBaseUrl(),
  wsUrl: getWsUrl(),
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
    accountPrompts: () => '/account/prompts',
    onboarding: '/onboarding',
    workspaces: '/workspaces',
    documents: (workspaceId: string) => `/workspaces/${workspaceId}/documents`,
    documentsGeneratePrompt: (workspaceId: string) =>
      `/workspaces/${workspaceId}/documents/generate-prompt`,
    chat: (workspaceId: string, documentId: string) => `/workspaces/${workspaceId}/documents/${documentId}/chat`,
    chatStream: (workspaceId: string, documentId: string) =>
      `/workspaces/${workspaceId}/documents/${documentId}/chat/stream`,
    privacy: (workspaceId: string) => `/workspaces/${workspaceId}/privacy`,
    audit: (workspaceId: string) => `/workspaces/${workspaceId}/audit`,
    settings: (workspaceId: string) => `/workspaces/${workspaceId}/settings`,
    prompts: (workspaceId: string) => `/workspaces/${workspaceId}/prompts`,
    documentPrompts: (workspaceId: string, documentId: string) =>
      `/workspaces/${workspaceId}/documents/${documentId}/prompts`,
    documentReEvaluateJurisdiction: (workspaceId: string, documentId: string) =>
      `/workspaces/${workspaceId}/documents/${documentId}/re-evaluate-jurisdiction`,
    documentParsers: (workspaceId: string) => `/workspaces/${workspaceId}/document-parsers`,
    documentReview: (workspaceId: string, documentId: string) =>
      `/workspaces/${workspaceId}/documents/${documentId}/review`,
    documentReviewRerun: (workspaceId: string, documentId: string) =>
      `/workspaces/${workspaceId}/documents/${documentId}/review/rerun`,
  },
};

// Expose API_CONFIG globally for debugging (development only)
if (typeof window !== 'undefined' && !environment.production) {
  (window as any).API_CONFIG = API_CONFIG;
  console.log('API_CONFIG available in console:', API_CONFIG);
}
