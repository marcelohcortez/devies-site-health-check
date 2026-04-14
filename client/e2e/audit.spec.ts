import { test, expect, type Page } from '@playwright/test';
import { MOCK_RESULT, MOCK_RESULT_2 } from './fixtures';

// ── Helpers ──────────────────────────────────────────────────────────────────

async function fillAndSubmit(page: Page, url = 'https://example.com') {
  await page.getByLabel('Your Name').fill('Jane Smith');
  await page.getByLabel('Email Address').fill('jane@example.com');
  await page.getByLabel('Website URL').fill(url);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Run Audit' }).click();
}

function mockAudit(page: Page, body: object, status = 200) {
  return page.route('/api/audit', route =>
    route.fulfill({ status, json: body })
  );
}

// ── Tests ────────────────────────────────────────────────────────────────────

test.describe('Audit flow — single site', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('shows loading screen while audit runs', async ({ page }) => {
    await page.route('/api/audit', async route => {
      await new Promise(resolve => setTimeout(resolve, 300));
      await route.fulfill({ json: { results: [MOCK_RESULT] } });
    });

    await fillAndSubmit(page);

    await expect(page.getByText('Running audit…')).toBeVisible();
    await expect(page.getByText('Audit Results')).toBeVisible({ timeout: 5000 });
  });

  test('hides form and shows results after success', async ({ page }) => {
    await mockAudit(page, { results: [MOCK_RESULT] });
    await fillAndSubmit(page);

    await expect(page.getByText('Audit Results')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Run Audit' })).not.toBeVisible();
  });

  test('shows personalised greeting with user name', async ({ page }) => {
    await mockAudit(page, { results: [MOCK_RESULT] });
    await fillAndSubmit(page);

    await expect(page.getByText("Hi Jane Smith, here's your website report.")).toBeVisible();
  });

  test('shows audited URL in result hero', async ({ page }) => {
    await mockAudit(page, { results: [MOCK_RESULT] });
    await fillAndSubmit(page);

    await expect(page.getByText('https://example.com')).toBeVisible();
  });

  test('shows overall score number', async ({ page }) => {
    await mockAudit(page, { results: [MOCK_RESULT] });
    await fillAndSubmit(page);

    // Score circle renders the number directly
    await expect(page.locator('.score-num')).toContainText('72');
  });

  test('shows summary text', async ({ page }) => {
    await mockAudit(page, { results: [MOCK_RESULT] });
    await fillAndSubmit(page);

    await expect(page.getByText(MOCK_RESULT.summary)).toBeVisible();
  });

  test('shows platform label', async ({ page }) => {
    await mockAudit(page, { results: [MOCK_RESULT] });
    await fillAndSubmit(page);

    // Scope to .result-platform to avoid matching 'html' in category bar labels
    await expect(page.locator('.result-platform strong')).toContainText('html');
  });

  test('shows category score bars', async ({ page }) => {
    await mockAudit(page, { results: [MOCK_RESULT] });
    await fillAndSubmit(page);

    // Scope to .categories-grid to avoid matching 'SEO' in the form intro or loading text
    const grid = page.locator('.categories-grid');
    await expect(grid.getByText('SEO')).toBeVisible();
    await expect(grid.getByText('Security')).toBeVisible();
    await expect(grid.getByText('Performance')).toBeVisible();
    await expect(grid.getByText('Accessibility')).toBeVisible();
    await expect(grid.getByText('HTML Structure')).toBeVisible();
  });

  test('shows critical and warning badge counts', async ({ page }) => {
    await mockAudit(page, { results: [MOCK_RESULT] });
    await fillAndSubmit(page);

    await expect(page.getByText('1 critical')).toBeVisible();
    await expect(page.getByText('1 warnings')).toBeVisible();
  });

  test('shows CTA contact link', async ({ page }) => {
    await mockAudit(page, { results: [MOCK_RESULT] });
    await fillAndSubmit(page);

    await expect(page.getByRole('link', { name: 'hello@devies.se' })).toBeVisible();
  });

  test('New Audit button resets view to form', async ({ page }) => {
    await mockAudit(page, { results: [MOCK_RESULT] });
    await fillAndSubmit(page);

    await expect(page.getByText('Audit Results')).toBeVisible();
    await page.getByRole('button', { name: 'New Audit' }).click();

    await expect(page.getByRole('button', { name: 'Run Audit' })).toBeVisible();
    await expect(page.getByText('Audit Results')).not.toBeVisible();
  });

  test('can run a second audit after resetting', async ({ page }) => {
    await mockAudit(page, { results: [MOCK_RESULT] });
    await fillAndSubmit(page);

    await page.getByRole('button', { name: 'New Audit' }).click();
    await expect(page.getByRole('button', { name: 'Run Audit' })).toBeEnabled();

    // Fields are still populated from the previous run
    await page.getByRole('button', { name: 'Run Audit' }).click();
    await expect(page.getByText('Audit Results')).toBeVisible();
  });
});

test.describe('Audit flow — multiple sites', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Multiple Websites' }).click();
    await page.getByLabel('Your Name').fill('Jane Smith');
    await page.getByLabel('Email Address').fill('jane@example.com');
    await page.getByLabel(/Website URLs/).fill(
      'https://example.com\nhttps://another.com'
    );
    await page.getByRole('checkbox').check();
  });

  test('shows site-selector tabs for each result', async ({ page }) => {
    await mockAudit(page, { results: [MOCK_RESULT, MOCK_RESULT_2] });
    await page.getByRole('button', { name: 'Run Audit' }).click();

    const tablist = page.getByRole('tablist', { name: 'Select website' });
    await expect(tablist).toBeVisible();
    await expect(page.getByRole('tab', { name: /example\.com/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /another\.com/ })).toBeVisible();
  });

  test('first site is selected by default', async ({ page }) => {
    await mockAudit(page, { results: [MOCK_RESULT, MOCK_RESULT_2] });
    await page.getByRole('button', { name: 'Run Audit' }).click();

    const firstTab = page.getByRole('tab', { name: /example\.com/ });
    await expect(firstTab).toHaveAttribute('aria-selected', 'true');
  });

  test('clicking second tab switches active result', async ({ page }) => {
    await mockAudit(page, { results: [MOCK_RESULT, MOCK_RESULT_2] });
    await page.getByRole('button', { name: 'Run Audit' }).click();

    await page.getByRole('tab', { name: /another\.com/ }).click();

    await expect(page.locator('.score-num')).toContainText('55');
    // Scope to .result-url to avoid matching the hidden textarea value
    await expect(page.locator('.result-url')).toContainText('https://another.com');
  });

  test('no site-selector tabs for single result', async ({ page }) => {
    // Override the textarea to have one URL only
    await page.getByLabel(/Website URLs/).fill('https://example.com');
    await mockAudit(page, { results: [MOCK_RESULT] });
    await page.getByRole('button', { name: 'Run Audit' }).click();

    await expect(page.getByRole('tablist')).not.toBeVisible();
  });
});

test.describe('Audit flow — grade display', () => {
  const gradeTable = [
    { score: 95, letter: 'A', cls: 'grade-a' },
    { score: 83, letter: 'B', cls: 'grade-b' },
    { score: 74, letter: 'C', cls: 'grade-c' },
    { score: 62, letter: 'D', cls: 'grade-d' },
    { score: 45, letter: 'F', cls: 'grade-f' },
  ] as const;

  for (const { score, letter } of gradeTable) {
    test(`score ${score} shows grade ${letter}`, async ({ page }) => {
      await page.goto('/');
      await mockAudit(page, {
        results: [{ ...MOCK_RESULT, overall_score: score }],
      });
      await page.getByLabel('Your Name').fill('Jane');
      await page.getByLabel('Email Address').fill('jane@example.com');
      await page.getByLabel('Website URL').fill('https://example.com');
      await page.getByRole('checkbox').check();
      await page.getByRole('button', { name: 'Run Audit' }).click();

      await expect(page.locator('.score-num')).toContainText(String(score));
      await expect(page.locator('.score-letter')).toContainText(letter);
    });
  }
});
