import * as path from 'path';
import { defineConfig, devices } from '@playwright/test';

const CI = !!process.env['CI'];
const AUTH_FILE = path.join(__dirname, 'playwright', '.auth', 'user.json');
const baseURL = process.env['E2E_BASE_URL'] ?? 'http://localhost:4200';

export default defineConfig({
  testDir: './src',
  globalSetup: './global-setup.ts',
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 2 : 0,
  workers: CI ? 1 : undefined,
  reporter: CI ? 'dot' : 'html',
  use: {
    baseURL,
    launchOptions: {
      slowMo: process.env['E2E_SLOW'] ? 3000 : 0,
    },
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },
  timeout: 15000,
  expect: {
    timeout: 10000,
  },
  projects: [
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    {
      name: 'chromium-authenticated',
      use: {
        ...devices['Desktop Chrome'],
        storageState: AUTH_FILE,
      },
      testMatch: /(workspaces|documents|settings|onboarding)\.spec\.ts/,
      dependencies: ['setup'],
    },
    {
      name: 'chromium-auth',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /auth\.spec\.ts/,
    },
  ],
  webServer: {
    command: 'cd .. && pnpm start',
    url: baseURL,
    reuseExistingServer: !CI,
    timeout: 60_000,
  },
});
