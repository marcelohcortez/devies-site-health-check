import { test, expect } from '@playwright/test';

test.describe('Login page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  // ── Rendering ────────────────────────────────────────────────────────────────

  test('shows heading and subtitle', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Admin Login' })).toBeVisible();
    await expect(page.getByText('Devies — Site Health Checker')).toBeVisible();
  });

  test('renders username, password fields and Sign in button', async ({ page }) => {
    await expect(page.getByLabel('Username')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  });

  // ── Success flow ─────────────────────────────────────────────────────────────

  test('stores token and navigates to /submissions on success', async ({ page }) => {
    // Stub a valid far-future JWT so the SubmissionsPage auth guard passes
    const payload = Buffer.from(JSON.stringify({ exp: 9_999_999_999 })).toString('base64');
    const fakeToken = `x.${payload}.x`;

    await page.route('/api/auth/login', route =>
      route.fulfill({ json: { token: fakeToken } })
    );
    await page.route('/api/submissions', route =>
      route.fulfill({ json: { submissions: [] } })
    );

    await page.getByLabel('Username').fill('admin');
    await page.getByLabel('Password').fill('secret');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page).toHaveURL('/submissions');
  });

  // ── Loading state ─────────────────────────────────────────────────────────────

  test('shows "Signing in…" while request is in flight', async ({ page }) => {
    await page.route('/api/auth/login', async route => {
      await new Promise(resolve => setTimeout(resolve, 400));
      route.fulfill({ json: { token: 'x.x.x' } });
    });

    await page.getByLabel('Username').fill('admin');
    await page.getByLabel('Password').fill('secret');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByRole('button', { name: 'Signing in…' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Signing in…' })).toBeDisabled();
  });

  // ── Error states ──────────────────────────────────────────────────────────────

  test('shows error alert on invalid credentials (401)', async ({ page }) => {
    await page.route('/api/auth/login', route =>
      route.fulfill({ status: 401, json: { error: 'Invalid credentials.' } })
    );

    await page.getByLabel('Username').fill('admin');
    await page.getByLabel('Password').fill('wrong');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByRole('alert')).toContainText('Invalid credentials.');
  });

  test('shows generic error on network failure', async ({ page }) => {
    await page.route('/api/auth/login', route => route.abort());

    await page.getByLabel('Username').fill('admin');
    await page.getByLabel('Password').fill('secret');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByRole('alert')).toContainText('Network error');
  });

  test('Sign in button re-enables after an error', async ({ page }) => {
    await page.route('/api/auth/login', route =>
      route.fulfill({ status: 401, json: { error: 'Bad credentials' } })
    );

    await page.getByLabel('Username').fill('admin');
    await page.getByLabel('Password').fill('wrong');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByRole('button', { name: 'Sign in' })).toBeEnabled();
  });
});
