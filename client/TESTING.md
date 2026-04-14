# Testing Guide — audit-web client

## Stack

| Tool | Purpose |
|------|---------|
| [Playwright](https://playwright.dev) | E2E browser tests |
| TypeScript | Type-safe test code |
| ESLint | Lint enforcement |

---

## Running tests

```bash
# Run all E2E tests (starts Vite dev server automatically)
npm run test:e2e

# Run a specific file
npx playwright test e2e/form.spec.ts

# Run a specific test by name
npx playwright test --grep "shows branding"

# Run with UI mode (interactive, great for debugging)
npx playwright test --ui

# Run with trace on every test (attach to report)
npx playwright test --trace on

# Open the HTML report from the last run
npx playwright show-report

# Also run type checking and linting before submitting
npm run typecheck
npm run lint
```

---

## Test files

```
e2e/
├── fixtures.ts      Shared mock data (SiteResult objects)
├── form.spec.ts     AuditForm — field rendering, mode toggle, error states
└── audit.spec.ts    Full audit flow — results view, tabs, grade display
```

---

## TDD workflow — mandatory for new features

Every user-visible feature must have a Playwright test **before** the implementation is written.

### Step-by-step

1. **Write the test first** — add it to the appropriate spec file or create a new one.
   The test must fail (`npx playwright test --reporter=list`).

2. **Implement the feature** — write the minimum code to make the test pass.

3. **Run the full suite** — ensure no regressions:
   ```bash
   npm run test:e2e
   ```
   All 32+ tests must pass before the work is considered done.

4. **Typecheck + lint** — both must be clean:
   ```bash
   npm run typecheck && npm run lint
   ```

### Where to add tests

| What changed | Where to add the test |
|---|---|
| New form field or form behaviour | `e2e/form.spec.ts` |
| New results view element | `e2e/audit.spec.ts` — "single site" describe block |
| New multi-site behaviour | `e2e/audit.spec.ts` — "multiple sites" describe block |
| New grade/score logic | `e2e/audit.spec.ts` — "grade display" describe block |
| New page or major new section | Create `e2e/<feature>.spec.ts` |

---

## Mocking the API

Tests never call the real Express API. All `/api/audit` requests are intercepted via
[`page.route()`](https://playwright.dev/docs/mock). The shared mock data lives in
[`e2e/fixtures.ts`](e2e/fixtures.ts).

```ts
// Intercept and return a fixed response
await page.route('/api/audit', route =>
  route.fulfill({ json: { results: [MOCK_RESULT] } })
);

// Simulate an error
await page.route('/api/audit', route =>
  route.fulfill({ status: 500, json: { error: 'Something went wrong' } })
);

// Simulate a network failure
await page.route('/api/audit', route => route.abort());
```

This means:
- Tests are instant (no real HTTP, no scraping)
- Tests run offline
- The Express server does **not** need to be running

---

## Selector conventions

Use semantic Playwright locators in this order of preference:

| Priority | Locator | Example |
|---|---|---|
| 1 (best) | `getByRole` | `page.getByRole('button', { name: 'Run Audit' })` |
| 2 | `getByLabel` | `page.getByLabel('Your Name')` |
| 3 | `getByText` | `page.getByText('Audit Results')` |
| 4 | CSS class (scoped) | `page.locator('.categories-grid').getByText('SEO')` |
| 5 (last resort) | `#id` | `page.locator('#url-multi')` |

**Strict-mode gotchas** — Playwright throws if a locator matches more than one element.
Scope the locator or use `{ exact: true }` to narrow it:

```ts
// BAD — 'html' matches both the platform badge AND the "HTML Structure" category
await page.getByText('html')

// GOOD — scoped to the platform section
await page.locator('.result-platform strong')

// BAD — 'Website URL' substring-matches 'Website URLs (0 / 10)'
await page.getByLabel('Website URL').not.toBeVisible()

// GOOD — exact match excludes 'Website URLs'
await page.getByLabel('Website URL', { exact: true }).not.toBeVisible()
```

---

## Known constraints

### React 18 state batching

`setSubmitting(true)` and `setView('loading')` are batched in the same render tick
(both called synchronously inside the same event handler chain). This means the form
transitions **directly** from "visible + idle" to "hidden + loading" — there is no
intermediate "visible + submitting" state.

Consequence: testing for a visible 'Running…' button is impossible. Test for the
loading screen instead:

```ts
// WRONG — 'Running…' is never visible (form is hidden when submitting=true)
await expect(page.getByRole('button', { name: 'Running…' })).toBeVisible();

// CORRECT — the loading screen is what the user actually sees
await expect(page.getByText('Running audit…')).toBeVisible();
```

### `submitting` state is controlled by App

`AuditForm` no longer owns `submitting` state. `App` manages it and passes it as a
prop so the button correctly resets to "Run Audit" after clicking "New Audit".
If you add a new submit flow, update `App.handleSubmit` and its `finally` block.

---

## CI

In CI, set `CI=true`. The Playwright config responds to this env var:

```
forbidOnly: !!process.env.CI   // fail if test.only is left in
retries: 2                      // retry flaky tests twice
workers: 1                      // single worker for stability
```
