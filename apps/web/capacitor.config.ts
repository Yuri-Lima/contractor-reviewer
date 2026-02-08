import { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor Configuration
 * 
 * Environment Variables:
 * - CAPACITOR_SERVER_URL: Override server URL for development (e.g., 'http://192.168.1.100:4200')
 * - NODE_ENV: Set to 'production' to disable dev server and use bundled files
 * 
 * Development:
 * - Set CAPACITOR_SERVER_URL to your local IP for physical device testing
 * - Use 'http://localhost:4200' for emulators/simulators
 * 
 * Production:
 * - Set NODE_ENV=production to bundle files in the native app
 * - Remove or comment out the server.url property
 */
const isProduction = process.env['NODE_ENV'] === 'production';
const serverUrl = process.env['CAPACITOR_SERVER_URL'];

const config: CapacitorConfig = {
  appId: 'com.contractai.review',
  appName: 'ContractAI Review',
  webDir: 'dist/contractai-web',
  server: isProduction
    ? undefined // Production: bundle files in native app
    : {
        androidScheme: 'https',
        iosScheme: 'https',
        // For development: use environment variable or default to localhost
        // For physical devices, set CAPACITOR_SERVER_URL to your local IP
        // Example: CAPACITOR_SERVER_URL=http://192.168.1.100:4200
        url: serverUrl || 'http://localhost:4200',
        cleartext: true, // Allow HTTP for development
      },
  plugins: {
    Keyboard: {
      resize: 'body',
      style: 'dark',
      resizeOnFullScreen: true,
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#ffffff',
    },
  },
};

export default config;
