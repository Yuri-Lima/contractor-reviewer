import { test as base, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

export const test = base.extend<{ authenticatedPage: Page }>({
  authenticatedPage: async ({ page }, use) => {
    await page.goto('/workspaces');
    await expect(page).toHaveURL(/\/workspaces/);
    await expect(page.getByRole('heading', { name: /workspaces/i })).toBeVisible();
    await use(page);
  },
});

export { expect };
