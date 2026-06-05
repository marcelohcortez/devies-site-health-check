import { test, expect } from '@playwright/test';
import { MOCK_RESULT } from './fixtures';

test.describe('Audit Form', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('shows branding', async ({ page }) => {
    await expect(page.getByText('Site Health Checker')).toBeVisible();
  });

  test('renders name, email and URL fields', async ({ page }) => {
    await expect(page.getByLabel('Your Name')).toBeVisible();
    await expect(page.getByLabel('Email Address')).toBeVisible();
    await expect(page.getByLabel('Website URL')).toBeVisible();
  });

  test('Run Audit button is present', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Run Audit' })).toBeVisible();
  });

  // React 18 batches setSubmitting(true) + setView('loading') in the same tick,
  // so the form hides before an intermediate 'Running…' render can appear.
  // The correct observable behavior is the loading screen appearing.
  test('shows loading screen while submitting', async ({ page }) => {
    await page.route('/api/audit', async route => {
      await new Promise(resolve => setTimeout(resolve, 400));
      await route.fulfill({ json: { results: [MOCK_RESULT] } });
    });

    await page.getByLabel('Your Name').fill('Jane');
    await page.getByLabel('Email Address').fill('jane@example.com');
    await page.getByLabel('Website URL').fill('https://example.com');
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Run Audit' }).click();

    await expect(page.getByText('Running audit…')).toBeVisible();
  });

  test('shows error alert when API returns an error', async ({ page }) => {
    await page.route('/api/audit', route =>
      route.fulfill({ status: 500, json: { error: 'Server exploded' } })
    );

    await page.getByLabel('Your Name').fill('Jane');
    await page.getByLabel('Email Address').fill('jane@example.com');
    await page.getByLabel('Website URL').fill('https://example.com');
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Run Audit' }).click();

    await expect(page.getByRole('alert')).toContainText('Server exploded');
  });

  test('shows generic error on network failure', async ({ page }) => {
    await page.route('/api/audit', route => route.abort());

    await page.getByLabel('Your Name').fill('Jane');
    await page.getByLabel('Email Address').fill('jane@example.com');
    await page.getByLabel('Website URL').fill('https://example.com');
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Run Audit' }).click();

    await expect(page.getByRole('alert')).toBeVisible();
  });

  test('Run Audit button re-enables after error', async ({ page }) => {
    await page.route('/api/audit', route =>
      route.fulfill({ status: 500, json: { error: 'fail' } })
    );

    await page.getByLabel('Your Name').fill('Jane');
    await page.getByLabel('Email Address').fill('jane@example.com');
    await page.getByLabel('Website URL').fill('https://example.com');
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Run Audit' }).click();

    // Button re-enables; consent is still checked so disabled=false
    await expect(page.getByRole('button', { name: 'Run Audit' })).toBeEnabled();
  });

  test('Run Audit button is disabled when consent is unchecked', async ({ page }) => {
    // Consent starts unchecked — button must be disabled regardless of other fields
    await expect(page.getByRole('button', { name: 'Run Audit' })).toBeDisabled();
  });

  test('Run Audit button enables after checking the consent checkbox', async ({ page }) => {
    await page.getByRole('checkbox').check();
    await expect(page.getByRole('button', { name: 'Run Audit' })).toBeEnabled();
  });

  test('unchecking consent disables the button again', async ({ page }) => {
    await page.getByRole('checkbox').check();
    await page.getByRole('checkbox').uncheck();
    await expect(page.getByRole('button', { name: 'Run Audit' })).toBeDisabled();
  });
});
