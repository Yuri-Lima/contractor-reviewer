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
    const confirmMessage = page.getByText(
      /restart onboarding and show|reiniciar.*onboarding|mostrará el tour|mostrará o tour|startet das onboarding/i,
    );
    await expect(confirmMessage).toBeVisible();
    await page
      .getByRole('button', { name: /reset onboarding|reset|redefinir|restablecer|neu starten/i })
      .last()
      .click();
    await expect(confirmMessage).not.toBeVisible({ timeout: 5000 });
  });
});
