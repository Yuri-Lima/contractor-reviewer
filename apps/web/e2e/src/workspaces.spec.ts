import { test, expect } from './fixtures/auth.fixture';

test.describe('Workspaces', () => {
  test('should show workspaces page when authenticated', async ({ authenticatedPage: page }) => {
    await expect(page).toHaveURL(/\/workspaces/);
    await expect(page.getByRole('heading', { name: /workspaces/i }).first()).toBeVisible();
  });

  test('should show create button', async ({ authenticatedPage: page }) => {
    const createBtn = page.getByTestId('workspaces-create-btn').or(page.getByTestId('workspaces-create-first'));
    await expect(createBtn.first()).toBeVisible();
  });

  test('should open create form and create workspace', async ({ authenticatedPage: page }) => {
    const createBtn = page.getByTestId('workspaces-create-btn').or(page.getByTestId('workspaces-create-first'));
    await createBtn.first().click();
    await expect(page.getByTestId('workspace-name-input')).toBeVisible();
    await page.getByTestId('workspace-name-input').fill(`E2E Workspace ${Date.now()}`);
    await page.getByTestId('workspace-create-submit').click();
    await expect(page.getByTestId('workspace-name-input')).not.toBeVisible();
    await expect(page).toHaveURL(/\/workspaces$/);
  });
});
