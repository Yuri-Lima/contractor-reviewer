import { test, expect } from './fixtures/auth.fixture';

test.describe('Onboarding', () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    if (!page.url().includes('/settings') || page.url().includes('/workspaces/')) {
      await page.goto('/settings');
    }
    await expect(page).toHaveURL(/\/settings$/);
  });

  test('should show Help & Onboarding section on account settings', async ({ authenticatedPage: page }) => {
    await expect(page.getByTestId('onboarding-help-card')).toBeVisible();
    await expect(page.getByTestId('onboarding-reset-btn')).toBeVisible();
    await expect(page.getByTestId('onboarding-start-tour-btn')).toBeVisible();
  });

  test('should reset onboarding when confirmed', async ({ authenticatedPage: page }) => {
    await page.getByTestId('onboarding-reset-btn').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    const acceptBtn = page.getByRole('button', { name: /reset onboarding|reset/i }).first();
    await acceptBtn.click();
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5000 });
    await expect(page.locator('.p-toast-message, [role="status"]').filter({ hasText: /restart|success/i })).toBeVisible({ timeout: 5000 });
  });
});
