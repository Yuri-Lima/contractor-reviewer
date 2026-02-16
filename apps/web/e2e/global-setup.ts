import { APIRequestContext } from '@playwright/test';

const API_URL = process.env['E2E_API_URL'] || 'http://localhost:3000/api';
const E2E_TEST_EMAIL = process.env['E2E_TEST_EMAIL'] || 'e2e-test@example.com';
const E2E_TEST_PASSWORD = process.env['E2E_TEST_PASSWORD'] || 'password123';
const E2E_TEST_NAME = process.env['E2E_TEST_NAME'] || 'E2E Test User';

async function ensureTestUser(): Promise<void> {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: E2E_TEST_EMAIL,
      password: E2E_TEST_PASSWORD,
    }),
  });

  if (response.ok) {
    console.log('E2E: Test user exists, login succeeded');
    return;
  }

  console.log('E2E: Test user not found, registering...');
  const registerResponse = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: E2E_TEST_EMAIL,
      password: E2E_TEST_PASSWORD,
      name: E2E_TEST_NAME,
    }),
  });

  if (registerResponse.ok) {
    console.log('E2E: Test user registered successfully');
    return;
  }

  if (registerResponse.status === 409) {
    console.log('E2E: Test user already exists (409), continuing');
    return;
  }

  const body = await registerResponse.text();
  console.warn(`E2E: Could not ensure test user (HTTP ${registerResponse.status}): ${body}`);
}

export default async function globalSetup(): Promise<void> {
  try {
    await ensureTestUser();
  } catch (err) {
    console.warn('E2E: API may not be available - some tests may fail:', err);
  }
}
