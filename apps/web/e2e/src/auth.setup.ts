import * as fs from 'fs';
import * as path from 'path';
import { test as setup, expect } from '@playwright/test';
import { waitForReady } from '../../src/app/core/utils/wait-for-ready';

const E2E_TEST_EMAIL = process.env['E2E_TEST_EMAIL'] || 'e2e-test@example.com';
const E2E_TEST_PASSWORD = process.env['E2E_TEST_PASSWORD'] || 'password123';

const authFile = path.join(__dirname, '..', 'playwright', '.auth', 'user.json');
const authDir = path.dirname(authFile);

setup('authenticate', async ({ page }) => {
  // Wait for API health before login — avoids 404 when the API is still seeding
  await waitForReady({ timeoutMs: 60_000, pollIntervalMs: 500 });

  await page.goto('/login');
  await page.getByTestId('login-email').fill(E2E_TEST_EMAIL);
  await page.locator('[data-testid="login-password"] input').fill(E2E_TEST_PASSWORD);
  await page.getByTestId('login-submit').click();
  await expect(page).toHaveURL(/\/workspaces/);
  fs.mkdirSync(authDir, { recursive: true });
  await page.context().storageState({ path: authFile });
}, { timeout: 90000 });
