/**
 * Production environment configuration
 *
 * Uses relative /api for same-origin deployment (Nginx reverse proxy).
 * If API is on a different domain, use fileReplacements in angular.json
 * or NG_APP_API_URL build-time override.
 */
export const environment = {
  production: true,
  apiUrl: '/api',
};
