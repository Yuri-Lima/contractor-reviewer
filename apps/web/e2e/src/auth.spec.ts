import { test, expect } from '@playwright/test';

const E2E_TEST_EMAIL = process.env['E2E_TEST_EMAIL'] || 'e2e-test@example.com';
const E2E_TEST_PASSWORD = process.env['E2E_TEST_PASSWORD'] || 'password123';
const E2E_TEST_NAME = process.env['E2E_TEST_NAME'] || 'E2E Test User';

test.describe('Auth', () => {
  test.describe('Login', () => {
    test('should redirect unauthenticated users to login', async ({ page }) => {
      await page.goto('/workspaces');
      await expect(page).toHaveURL(/\/login/);
    });

    test('should show login form with email and password fields', async ({ page }) => {
      await page.goto('/login');
      await expect(page.getByTestId('login-email')).toBeVisible();
      await expect(page.locator('[data-testid="login-password"]')).toBeVisible();
      await expect(page.getByTestId('login-submit')).toBeVisible();
    });

    test('should show validation errors for empty form', async ({ page }) => {
      await page.goto('/login');
      await page.getByTestId('login-email').focus();
      await page.getByTestId('login-email').blur();
      await expect(page.getByText(/invalid email/i)).toBeVisible();
    });

    test('should navigate to register page', async ({ page }) => {
      await page.goto('/login');
      await page.getByTestId('login-register-link').click();
      await expect(page).toHaveURL(/\/register/);
    });

    test('should login successfully with valid credentials', async ({ page }) => {
      await page.goto('/login');
      await page.getByTestId('login-email').fill(E2E_TEST_EMAIL);
      await page.locator('[data-testid="login-password"] input').fill(E2E_TEST_PASSWORD);
      await page.getByTestId('login-submit').click();
      await expect(page).toHaveURL(/\/workspaces/);
    });

    test('should show error for invalid credentials', async ({ page }) => {
      await page.goto('/login');
      await page.getByTestId('login-email').fill('invalid@example.com');
      await page.locator('[data-testid="login-password"] input').fill('wrongpassword');
      await page.getByTestId('login-submit').click();
      await expect(page.getByText(/invalid|error/i)).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Register', () => {
    test('should show register form', async ({ page }) => {
      await page.goto('/register');
      await expect(page.getByTestId('register-name')).toBeVisible();
      await expect(page.getByTestId('register-email')).toBeVisible();
      await expect(page.locator('[data-testid="register-password"]')).toBeVisible();
      await expect(page.getByTestId('register-submit')).toBeVisible();
    });

    test('should navigate to login page', async ({ page }) => {
      await page.goto('/register');
      await page.getByTestId('register-login-link').click();
      await expect(page).toHaveURL(/\/login/);
    });

    test('should register new user and redirect to workspaces', async ({ page }) => {
      test.setTimeout(30000);
      const uniqueEmail = `e2e-${Date.now()}@example.com`;
      await page.goto('/register');
      await page.getByTestId('register-name').fill(E2E_TEST_NAME);
      await page.getByTestId('register-email').fill(uniqueEmail);
      await page.locator('[data-testid="register-password"] input').fill(E2E_TEST_PASSWORD);
      await page.locator('[data-testid="register-password"] input').press('Enter');
      await expect(page).toHaveURL(/\/workspaces/);
    });
  });
});
