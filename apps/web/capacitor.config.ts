import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.contractai.review',
  appName: 'ContractAI Review',
  webDir: 'dist/contractai-web',
  server: {
    androidScheme: 'https',
    iosScheme: 'https',
    // For development, allow localhost
    url: process.env['CAPACITOR_SERVER_URL'] || 'http://localhost:4200',
    cleartext: true,
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
