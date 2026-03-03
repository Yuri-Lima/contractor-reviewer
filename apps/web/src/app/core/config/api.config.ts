import { environment } from '../../../environments/environment';
import { Capacitor } from '@capacitor/core';

/**
 * Get the API base URL based on the current platform
 * - Web: Uses environment.apiUrl (typically localhost:3000/api)
 * - Mobile (Capacitor): Detects if running on device/emulator and adjusts URL
 *   - Physical devices: Uses the computer's local IP (must be on same network)
 *   - Emulators: Can use localhost or special addresses
 */
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
    chat: (workspaceId: string, documentId: string) => `/workspaces/${workspaceId}/documents/${documentId}/chat`,
    redline: (workspaceId: string, documentId: string) => `/workspaces/${workspaceId}/documents/${documentId}/redline`,
    privacy: (workspaceId: string) => `/workspaces/${workspaceId}/privacy`,
    audit: (workspaceId: string) => `/workspaces/${workspaceId}/audit`,
    retention: (workspaceId: string) => `/workspaces/${workspaceId}/retention`,
    settings: (workspaceId: string) => `/workspaces/${workspaceId}/settings`,
    prompts: (workspaceId: string) => `/workspaces/${workspaceId}/prompts`,
    documentPrompts: (workspaceId: string, documentId: string) =>
      `/workspaces/${workspaceId}/documents/${documentId}/prompts`,
    documentParsers: (workspaceId: string) => `/workspaces/${workspaceId}/document-parsers`,
  },
};

// Expose API_CONFIG globally for debugging (development only)
if (typeof window !== 'undefined' && !environment.production) {
  (window as any).API_CONFIG = API_CONFIG;
  console.log('API_CONFIG available in console:', API_CONFIG);
}
