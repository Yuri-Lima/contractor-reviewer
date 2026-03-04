import { test, expect } from './fixtures/auth.fixture';

test.describe('Settings', () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    if (!page.url().includes('/settings')) {
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
      await page.goto(page.url().replace('/documents', '/settings'));
    }
  });

  test('should load workspace settings page', async ({ authenticatedPage: page }) => {
    await expect(page.getByTestId('workspace-settings-page')).toBeVisible();
  });
});

test.describe('Privacy', () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    if (!page.url().includes('/privacy')) {
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
      await page.goto(page.url().replace('/documents', '/privacy'));
    }
  });

  test('should load privacy page', async ({ authenticatedPage: page }) => {
    await expect(page.getByTestId('privacy-page')).toBeVisible();
  });
});

test.describe('Audit', () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    if (!page.url().includes('/audit')) {
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
      await page.goto(page.url().replace('/documents', '/audit'));
    }
  });

  test('should load audit page', async ({ authenticatedPage: page }) => {
    await expect(page.getByTestId('audit-page')).toBeVisible();
  });
});
