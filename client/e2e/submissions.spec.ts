import { test, expect, type Page } from '@playwright/test';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MOCK_SUBMISSIONS = [
  {
    id: 1,
    name: 'Alice',
    email: 'alice@example.com',
    url: 'https://alice.com',
    score: 85,
    platform: 'html',
    created_at: '2024-01-01T10:00:00.000Z',
  },
  {
    id: 2,
    name: 'Bob',
    email: 'bob@test.org',
    url: 'https://bob.com',
    score: 55,
    platform: 'wordpress',
    created_at: '2024-01-02T12:00:00.000Z',
  },
];

const MOCK_AUDIT_DATA = {
  url: 'https://alice.com',
  generated_at: '2024-01-01T10:00:00.000Z',
  platform_name: 'html',
  interpretation: {
    overall_score: 85,
    summary: 'Good site with minor issues.',
    category_scores: { SEO: 90, Security: 80 },
    findings: [
      {
        severity: 'warning',
        title: 'Missing CSP',
        finding: 'No Content-Security-Policy header.',
        how_to_fix: 'Add a CSP header.',
      },
      {
        severity: 'positive',
        title: 'HTTPS enabled',
        finding: 'Site is served over HTTPS.',
      },
    ],
  },
  http: { status_code: 200, response_time_ms: 450, https: true, server: 'nginx' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Injects a valid (non-expired) fake JWT into localStorage before page load. */
async function setAuthToken(page: Page) {
  await page.addInitScript(() => {
    // payload = {"exp":9999999999} — far future, never expires in tests
    localStorage.setItem('auditAdminToken', 'x.eyJleHAiOjk5OTk5OTk5OTl9.x');
  });
}

// ── Auth guard ────────────────────────────────────────────────────────────────

test.describe('Submissions page — auth guard', () => {
  test('redirects to /login when no token is present', async ({ page }) => {
    // No setAuthToken — localStorage is empty
    await page.goto('/submissions');
    await expect(page).toHaveURL('/login');
  });

  test('redirects to /login when token is expired', async ({ page }) => {
    await page.addInitScript(() => {
      // payload = {"exp":1} — expired in the past
      localStorage.setItem('auditAdminToken', 'x.eyJleHAiOjF9.x');
    });
    await page.goto('/submissions');
    await expect(page).toHaveURL('/login');
  });
});

// ── Authenticated flows ───────────────────────────────────────────────────────

test.describe('Submissions page — authenticated', () => {
  test.beforeEach(async ({ page }) => {
    await setAuthToken(page);
    await page.route('/api/submissions', route =>
      route.fulfill({ json: { submissions: MOCK_SUBMISSIONS } })
    );
    await page.goto('/submissions');
    // Wait for the initial fetch to complete and the table to render
    await expect(page.getByRole('table')).toBeVisible();
  });

  // ── Rendering ──────────────────────────────────────────────────────────────

  test('shows Submissions heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Submissions' })).toBeVisible();
  });

  test('shows total count', async ({ page }) => {
    await expect(page.getByText('2 total')).toBeVisible();
  });

  test('renders table with submission rows', async ({ page }) => {
    await expect(page.getByRole('table')).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Alice', exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Bob', exact: true })).toBeVisible();
  });

  test('shows score badges in the table', async ({ page }) => {
    // Alice: 85 → grade B
    await expect(page.locator('.score-badge').first()).toContainText('85');
  });

  test('shows platform chips in the table', async ({ page }) => {
    await expect(page.locator('.platform-chip').first()).toContainText('html');
    await expect(page.locator('.platform-chip').nth(1)).toContainText('wordpress');
  });

  // ── Filter ─────────────────────────────────────────────────────────────────

  test('filters rows by email', async ({ page }) => {
    await page.getByPlaceholder('Filter by email or URL…').fill('alice');
    await expect(page.getByRole('cell', { name: 'Alice', exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Bob', exact: true })).not.toBeVisible();
    await expect(page.getByText('1 total')).toBeVisible();
  });

  test('filters rows by URL', async ({ page }) => {
    await page.getByPlaceholder('Filter by email or URL…').fill('bob.com');
    await expect(page.getByRole('cell', { name: 'Bob', exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Alice', exact: true })).not.toBeVisible();
  });

  test('filter is case-insensitive', async ({ page }) => {
    await page.getByPlaceholder('Filter by email or URL…').fill('ALICE');
    await expect(page.getByRole('cell', { name: 'Alice', exact: true })).toBeVisible();
  });

  test('clearing the filter restores all rows', async ({ page }) => {
    await page.getByPlaceholder('Filter by email or URL…').fill('alice');
    await expect(page.getByText('1 total')).toBeVisible();

    await page.getByPlaceholder('Filter by email or URL…').clear();
    await expect(page.getByText('2 total')).toBeVisible();
  });

  // ── Empty state ─────────────────────────────────────────────────────────────

  test('shows "No submissions yet." when the list is empty', async ({ page }) => {
    // Override the route for this test only
    await page.route('/api/submissions', route =>
      route.fulfill({ json: { submissions: [] } })
    );
    await page.getByRole('button', { name: 'Refresh' }).click();
    await expect(page.getByText('No submissions yet.')).toBeVisible();
  });

  // ── Refresh ─────────────────────────────────────────────────────────────────

  test('Refresh button reloads the submissions list', async ({ page }) => {
    let callCount = 0;
    await page.route('/api/submissions', route => {
      callCount++;
      route.fulfill({ json: { submissions: MOCK_SUBMISSIONS } });
    });

    await page.getByRole('button', { name: 'Refresh' }).click();
    // After the initial load + one refresh, the endpoint should have been called twice
    await expect(page.getByText('2 total')).toBeVisible();
    expect(callCount).toBeGreaterThanOrEqual(1);
  });

  // ── Logout ──────────────────────────────────────────────────────────────────

  test('Logout button removes token and redirects to /login', async ({ page }) => {
    await page.getByRole('button', { name: 'Logout' }).click();
    await expect(page).toHaveURL('/login');

    // Token must be gone so a reload would redirect again
    const token = await page.evaluate(() => localStorage.getItem('auditAdminToken'));
    expect(token).toBeNull();
  });

  // ── API errors ──────────────────────────────────────────────────────────────

  test('shows error box when submissions fetch fails', async ({ page }) => {
    await page.route('/api/submissions', route =>
      route.fulfill({ status: 500, json: { error: 'DB error' } })
    );
    await page.getByRole('button', { name: 'Refresh' }).click();
    await expect(page.getByText('Failed to load submissions.')).toBeVisible();
  });

  test('redirects to /login when submissions fetch returns 401', async ({ page }) => {
    // Override before clicking Refresh; new route takes LIFO precedence
    await page.route('/api/submissions', route =>
      route.fulfill({ status: 401, json: {} })
    );
    // Refresh is visible because beforeEach loaded the table successfully
    await page.getByRole('button', { name: 'Refresh' }).click();
    await expect(page).toHaveURL('/login');
  });
});

// ── Pagination ────────────────────────────────────────────────────────────────

test.describe('Submissions page — pagination', () => {
  test('shows Previous and Next buttons when there are more than 50 rows', async ({ page }) => {
    await setAuthToken(page);

    const manySubmissions = Array.from({ length: 55 }, (_, i) => ({
      id: i + 1,
      name: `User ${i + 1}`,
      email: `user${i + 1}@example.com`,
      url: `https://site${i + 1}.com`,
      score: 70,
      platform: 'html',
      created_at: '2024-01-01T10:00:00.000Z',
    }));

    await page.route('/api/submissions', route =>
      route.fulfill({ json: { submissions: manySubmissions } })
    );
    await page.goto('/submissions');

    await expect(page.getByText('Page 1 of 2')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Previous' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Next' })).toBeEnabled();
  });

  test('Next/Previous navigate between pages', async ({ page }) => {
    await setAuthToken(page);

    const manySubmissions = Array.from({ length: 55 }, (_, i) => ({
      id: i + 1,
      name: `User ${i + 1}`,
      email: `user${i + 1}@example.com`,
      url: `https://site${i + 1}.com`,
      score: 70,
      platform: 'html',
      created_at: '2024-01-01T10:00:00.000Z',
    }));

    await page.route('/api/submissions', route =>
      route.fulfill({ json: { submissions: manySubmissions } })
    );
    await page.goto('/submissions');

    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByText('Page 2 of 2')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Next' })).toBeDisabled();

    await page.getByRole('button', { name: 'Previous' }).click();
    await expect(page.getByText('Page 1 of 2')).toBeVisible();
  });

  test('filtering resets to page 1', async ({ page }) => {
    await setAuthToken(page);

    const manySubmissions = Array.from({ length: 55 }, (_, i) => ({
      id: i + 1,
      name: `User ${i + 1}`,
      email: `user${i + 1}@example.com`,
      url: `https://site${i + 1}.com`,
      score: 70,
      platform: 'html',
      created_at: '2024-01-01T10:00:00.000Z',
    }));

    await page.route('/api/submissions', route =>
      route.fulfill({ json: { submissions: manySubmissions } })
    );
    await page.goto('/submissions');

    // Navigate to page 2 first
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByText('Page 2 of 2')).toBeVisible();

    // 'user' matches all 55 rows → still 2 pages, but resets to page 1
    await page.getByPlaceholder('Filter by email or URL…').fill('user');
    await expect(page.getByText('Page 1 of 2')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Previous' })).toBeDisabled();
  });
});

// ── Detail panel ──────────────────────────────────────────────────────────────

test.describe('Submissions page — detail panel', () => {
  test.beforeEach(async ({ page }) => {
    await setAuthToken(page);
    await page.route('/api/submissions', route =>
      route.fulfill({ json: { submissions: MOCK_SUBMISSIONS } })
    );
    await page.route('/api/submissions/1/data', route =>
      route.fulfill({ json: MOCK_AUDIT_DATA })
    );
    await page.goto('/submissions');
  });

  test('"View details" button opens the detail panel dialog', async ({ page }) => {
    await page.getByRole('button', { name: 'View details' }).first().click();
    await expect(page.getByRole('dialog', { name: 'Submission detail' })).toBeVisible();
  });

  test('detail panel shows the hostname as its title', async ({ page }) => {
    await page.getByRole('button', { name: 'View details' }).first().click();
    await expect(page.getByRole('dialog').getByRole('heading')).toContainText('alice.com');
  });

  test('detail panel shows summary after data loads', async ({ page }) => {
    await page.getByRole('button', { name: 'View details' }).first().click();
    await expect(page.getByText('Good site with minor issues.')).toBeVisible();
  });

  test('detail panel shows category score bars', async ({ page }) => {
    await page.getByRole('button', { name: 'View details' }).first().click();
    // Scope to .cat-name to avoid false matches in finding descriptions
    await expect(page.getByRole('dialog').locator('.cat-name', { hasText: 'SEO' })).toBeVisible();
    await expect(page.getByRole('dialog').locator('.cat-name', { hasText: 'Security' })).toBeVisible();
  });

  test('detail panel shows findings grouped by severity', async ({ page }) => {
    await page.getByRole('button', { name: 'View details' }).first().click();
    await expect(page.getByText('Missing CSP')).toBeVisible();
    await expect(page.getByText('HTTPS enabled')).toBeVisible();
  });

  test('"Close" button in header closes the panel', async ({ page }) => {
    await page.getByRole('button', { name: 'View details' }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();

    // The header close button (first Close button)
    await page.getByRole('dialog').getByRole('button', { name: 'Close' }).first().click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });

  test('"Close" button in footer closes the panel', async ({ page }) => {
    await page.getByRole('button', { name: 'View details' }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();

    // The footer close button (last Close button)
    await page.getByRole('dialog').getByRole('button', { name: 'Close' }).last().click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });

  test('clicking the overlay outside the panel closes it', async ({ page }) => {
    await page.getByRole('button', { name: 'View details' }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();

    // Click the overlay (the .detail-overlay element) at the very edge
    await page.locator('.detail-overlay').click({ position: { x: 5, y: 5 } });
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });

  test('"Download JSON" button is enabled after data loads', async ({ page }) => {
    await page.getByRole('button', { name: 'View details' }).first().click();
    await expect(page.getByRole('button', { name: 'Download JSON' })).toBeEnabled();
  });

  test('detail panel shows loading state before data arrives', async ({ page }) => {
    await page.route('/api/submissions/1/data', async route => {
      await new Promise(resolve => setTimeout(resolve, 400));
      route.fulfill({ json: MOCK_AUDIT_DATA });
    });

    await page.getByRole('button', { name: 'View details' }).first().click();
    await expect(page.getByText('Loading audit data…')).toBeVisible();
    // Download JSON must be disabled while loading
    await expect(page.getByRole('button', { name: 'Download JSON' })).toBeDisabled();
  });

  test('detail panel shows error when data fetch fails', async ({ page }) => {
    await page.route('/api/submissions/1/data', route =>
      route.fulfill({ status: 500, json: {} })
    );

    await page.getByRole('button', { name: 'View details' }).first().click();
    await expect(page.getByText('Failed to load audit data.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Download JSON' })).toBeDisabled();
  });

  test('detail panel 401 on data fetch redirects to /login', async ({ page }) => {
    await page.route('/api/submissions/1/data', route =>
      route.fulfill({ status: 401, json: {} })
    );

    await page.getByRole('button', { name: 'View details' }).first().click();
    await expect(page).toHaveURL('/login');
  });
});
