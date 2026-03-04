import { test, expect } from './fixtures/auth.fixture';

test.describe('Documents', () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    if (!page.url().includes('/documents')) {
      await expect(page.getByRole('heading', { name: /workspaces/i }).first()).toBeVisible();
      await page.waitForLoadState('networkidle');
      await page
        .getByTestId('workspace-view-documents')
        .or(page.getByTestId('workspaces-create-first'))
        .first()
        .waitFor({ state: 'visible', timeout: 10000 });
      const viewDocs = page.getByTestId('workspace-view-documents');
      if ((await viewDocs.count()) > 0) {
        await viewDocs.first().click();
      } else {
        await page.getByTestId('workspaces-create-first').click({ timeout: 15000 });
        await page.getByTestId('workspace-name-input').fill(`E2E Workspace ${Date.now()}`);
        await page.getByTestId('workspace-create-submit').click();
        await expect(page.getByTestId('workspace-view-documents').first()).toBeVisible();
        await page.getByTestId('workspace-view-documents').first().click();
      }
      await expect(page).toHaveURL(/\/workspaces\/[a-f0-9-]+\/documents/);
    }
  });

  test('should show documents page', async ({ authenticatedPage: page }) => {
    await expect(page.getByRole('heading', { name: /documents/i })).toBeVisible();
  });

  test('should show create document button or empty state', async ({ authenticatedPage: page }) => {
    const createBtn = page.getByTestId('documents-create-btn');
    const emptyState = page.getByTestId('documents-empty-state');
    await expect(createBtn.or(emptyState).first()).toBeVisible();
  });

  test('should create document', async ({ authenticatedPage: page }) => {
    test.setTimeout(30000);
    await page.getByTestId('documents-create-btn').click();
    await page.getByTestId('document-title-input').fill(`E2E Document ${Date.now()}`);
    await page.getByTestId('document-create-submit').click();
    await expect(page.getByTestId('documents-empty-state')).not.toBeVisible();
  });
});
