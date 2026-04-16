# audit-web — Task List

<!--
  STATUS LEGEND
  ─────────────
  [ ]  Not started
  [~]  In progress
  [x]  Done
  [!]  Blocked (dependency noted)
  [-]  Deferred / cancelled

  PREFIXES
  ────────
  [DECIDE]  Must be resolved in SPEC.md before work can begin on dependent tasks.
  [FILL]    A value in SPEC.md or config must be filled before this task.
  [TEST]    Write/update tests for this task.

  HOW TO USE
  ──────────
  1. Work top-to-bottom within each phase.
  2. A task tagged [DECIDE] or [FILL] blocks all tasks that reference the same decision.
  3. When you start a task, move it to [~] and note the date.
  4. When done, move to [x], check its acceptance criteria in SPEC.md, then unblock dependents.
-->

---

## Phase 0 — Decisions (must complete before Phase 2)

These are not implementation tasks. They require you to update SPEC.md.

| ID    | Task                                             | Spec ref | Status |
|-------|--------------------------------------------------|----------|--------|
| T-000 | [DECIDE] Web framework (Next.js vs Vite+Express) | D-001    | [x]    |
| T-001 | [DECIDE] Package manager (npm / pnpm / yarn)     | D-002    | [x]    |
| T-002 | [DECIDE] Build orchestrator (none / Turborepo)   | D-003    | [x]    |
| T-003 | [DECIDE] Database for submissions                | D-004    | [x]    |
| T-004 | ~~PDF generation~~ — RESOLVED: no PDF, save audit_data.json instead | D-005 | [x] |
| T-005 | [DECIDE] Styling system (plain CSS / Tailwind)   | D-006    | [x]    |
| T-006 | [DECIDE] Rate limiting strategy                  | D-007    | [x]    |
| T-007 | [FILL] Answer open questions Q-1 through Q-7     | §11      | [x]    |

---

## Phase 1 — Repository foundation

> Can begin immediately. Does not require Phase 0 decisions.

- [ ] **T-010** Create root `package.json` with workspaces config
  - Paths: `apps/*` and `packages/*`
  - Scripts: `build`, `dev`, `lint` delegated to workspaces
  - Depends on: T-001 (package manager choice affects syntax)

- [ ] **T-011** Create `packages/audit-core/` scaffold
  - `package.json` with name `@audit-web/audit-core`
  - Empty `src/index.js` with TODO stubs
  - Empty `src/rules/`, `src/scraper/`, `src/interpreter/` directories

- [ ] **T-012** Create `apps/web/` scaffold
  - Stub `package.json` with name `@audit-web/web`
  - Depends on: T-000 (framework choice)

- [ ] **T-013** Migrate existing code to new structure
  - Move `audit-web/client/src/` → `apps/web/src/` (or `apps/web/app/` for Next.js)
  - Move `audit-web/api/` → `apps/web/app/api/` (Next.js) OR `apps/api/` (Express)
  - Delete old `audit-web/api/` and `audit-web/client/` once migration confirmed
  - Update all import paths

- [ ] **T-014** Set up `turbo.json` (if T-002 chose Turborepo)
  - Define `build`, `dev`, `lint` pipelines
  - Depends on: T-002

- [ ] **T-015** Set up `.gitignore` at workspace root
  - Ignore: `node_modules`, `.turbo`, `dist`, `.next`, `*.db`, `.env*.local`

- [ ] **T-016** Set up `.env.example` at workspace root
  - Document all variables from SPEC.md §10.1 (including `AUDIT_MAX_PAGES`)

---

## Phase 2 — audit-core package

> Requires: T-011, T-013. Some tasks require Phase 0 decisions.
> Goal: `packages/audit-core` is a fully independent, importable package.

### Scraper

- [ ] **T-020** Copy `site-auditor/scraper.js` → `packages/audit-core/src/scraper/index.js`
  - Remove any `require()` that references outside `packages/audit-core/`
  - Verify all exports: `scrape(url)` returns the documented `scrapedData` shape (SPEC §5)
  - Add JSDoc to the public `scrape()` export

- [ ] **T-021** Copy `site-auditor/detector.js` → `packages/audit-core/src/scraper/detector.js`
  - Same clean-up as T-020

- [ ] **T-022** [TEST] Write unit tests for scraper
  - Test with a known URL (or mock HTTP server)
  - Assert all top-level keys exist in the returned object
  - Assert `platform.platform` is a string

### Rules

- [ ] **T-023** Copy `site-auditor/rules/seo.js` → `packages/audit-core/src/rules/seo.js`
  - Remove external imports if any
  - Verify rule count: 19

- [ ] **T-024** Copy `site-auditor/rules/security.js` → `packages/audit-core/src/rules/security.js`
  - Verify rule count: 17

- [ ] **T-025** Copy `site-auditor/rules/performance.js` → `packages/audit-core/src/rules/performance.js`
  - Verify rule count: 12

- [ ] **T-026** Copy `site-auditor/rules/accessibility.js` → `packages/audit-core/src/rules/accessibility.js`
  - Verify rule count: 18

- [ ] **T-027** Copy `site-auditor/rules/html.js` → `packages/audit-core/src/rules/html.js`
  - Verify rule count: 9

- [ ] **T-028** Copy `site-auditor/rules/wordpress.js` → `packages/audit-core/src/rules/wordpress.js`
  - Verify rule count: 23

- [ ] **T-029** Copy `site-auditor/rules/strapi.js` → `packages/audit-core/src/rules/strapi.js`
  - Verify rule count: 27
  - [FILL: Resolve Q-5 — are Strapi rules needed in v1?]

- [ ] **T-030** [TEST] Verify each rule file exports an array
  - Count rules per file matches SPEC.md §7.4
  - Each rule satisfies the interface (id, category, severity, weight, check fn, finding fn)

### Interpreter

- [ ] **T-031** Copy `site-auditor/rule-interpreter.js` → `packages/audit-core/src/interpreter/index.js`
  - Update `require()` paths to point to `../rules/*`
  - Remove references to `geo.js` rule if not copied (or copy it too — [FILL: decide])
  - Verify export: `interpret(scrapedData)` returns documented shape

- [ ] **T-032** Export public API from `packages/audit-core/src/index.js`
  ```js
  export { scrape }    from './scraper/index.js';
  export { interpret } from './interpreter/index.js';
  ```

- [ ] **T-033** [TEST] Integration test: `scrape` + `interpret` on a real URL
  - `overall_score` is 0–100
  - `category_scores` keys match the scoring model in SPEC §7.3
  - `findings` is an array
  - Test with at least one known-bad URL (e.g. HTTP site) and assert `sec_no_https` fires

---

## Phase 2b — Multi-page Crawl (F-011)

> Requires: T-020 (scraper), T-031 (interpreter). Adds crawl capability to `audit-core`.
> Goal: `crawl(url, { maxPages })` is the new default entry point used by the API route.

- [x] **T-034** Implement `discoverLinks(primary)` in `packages/audit-core/src/scraper/index.js`
  - Extract `<a href>` from `primary.body` (reuse Cheerio already loaded during scrape)
  - Filter: same origin only, no query params, no fragments, no mailto/tel
  - Normalise: resolve relative URLs, strip trailing slashes, lowercase path
  - Deduplicate by normalised path
  - Return up to `maxPages * 4` candidates (over-fetch so we have fallbacks if pages 404)
  - Export as `discoverLinks(primary, baseUrl)` — pure function, no HTTP calls

- [x] **T-035** Implement `scrapePage(url)` in `packages/audit-core/src/scraper/index.js`
  - Lightweight scrape: HTTP GET + HTML parse only — **no** security probes, **no** WP/Strapi probes, **no** robots/sitemap fetch, **no** link-checking
  - Returns `LightScrapedData` (shape documented in SPEC §7.1)
  - Reuses `fetchUrl()` for the HTTP call (SSRF protection inherited)
  - 10 s timeout (pass as option to `fetchUrl`)
  - On non-200 status: still return the object, set `status_code` to the actual status
  - On fetch error (timeout, DNS fail): return `null` — caller skips the page
  - Export as named export `scrapePage(url)`

- [x] **T-036** Implement `crawl(url, { maxPages })` in `packages/audit-core/src/scraper/index.js`
  - Step 1: `await scrape(url)` → `primary`
  - Step 2: `discoverLinks(primary, url)` → candidate URLs
  - Step 3: Take first `maxPages - 1` candidates (after dedup); fetch all in parallel via `Promise.allSettled`
    - Each inner page: `scrapePage(innerUrl)` with 10 s timeout
  - Step 4: Filter out `null` results (failed fetches)
  - Step 5: Return `{ primary, pages: LightScrapedData[] }`
  - Overall crawl: `Promise.race` against a 60 s timeout; partial results returned if timeout fires
  - `maxPages` defaults to `parseInt(process.env.AUDIT_MAX_PAGES) || 5`; clamp to min 1
  - Export as named export `crawl(url, opts)`
  - Update `packages/audit-core/src/index.js` to re-export `crawl` and `scrapePage`

- [x] **T-037** Add aggregate rules for multi-page findings
  - New file: `packages/audit-core/src/rules/multipage.js`
  - Implement the 10 aggregate rules from SPEC F-011 (see rule table in spec)
  - Rule `check(d)` receives the full `siteData` (`{ primary, pages }`); when called with plain `scrapedData` (backward compat), return `false`
  - Rule `finding(d)` lists affected page paths, e.g. `"Missing title on 2 pages: /about, /contact"`
  - All 10 rules: `severity: 'warning'`, weights between 3–8 (lower than homepage equivalents — inner pages are supplemental signal)
  - Add `multipage.js` to the rule-loader in `packages/audit-core/src/interpreter/index.js`

- [x] **T-038** Update `interpret()` to accept `siteData` shape
  - `interpret(input)` — detect shape: if `input.primary` exists, use `input.primary` as `scrapedData` for the 125 homepage rules; also pass `input` to multipage rules
  - If `input` has no `.primary` key, treat it as plain `scrapedData` (unchanged single-page path)
  - Add `pages_crawled: 1 + (input.pages?.length ?? 0)` to the returned result object
  - No changes to scoring weights or category model

- [x] **T-031c** Make GEO (AI_Readiness) always active — **Priority: HIGH**
  - In `packages/audit-core/src/interpreter/index.js`:
    - Remove the `useGeo` / `options.geo` flag — GEO rules now always fire
    - Replace `BASE_WEIGHTS` (no-GEO) with a single weight set that always includes `AI_Readiness: 0.15`
    - New base weights: SEO 20%, Security 20%, Performance 15%, Accessibility 15%, HTML_Structure 15%, AI_Readiness 15% (per SPEC §7.3)
    - `buildWeights()` no longer needs the `useGeo` parameter — simplify accordingly
    - Remove `BASE_WEIGHTS_GEO` — it becomes the only weight set
    - GEO rules are appended to `BASE_RULES` unconditionally (or merged into `activeRules` without flag)
    - `activeCategories` always includes `'AI_Readiness'`
    - `interpret(input, options)` signature preserved for backward compat; `options.geo` silently ignored
  - In `api/routes/audit.js`: remove `{ geo: true }` option if it was being passed (no-op cleanup)
  - Verify with smoke test: `interpret({ seo: {}, html: {}, ... })` returns `category_scores.AI_Readiness` as a number

- [ ] **T-039** [TEST] Integration test for `crawl` + `interpret`
  - `crawl('https://example.com', { maxPages: 3 })` returns `{ primary, pages }` with `pages.length >= 0`
  - `interpret(siteData).pages_crawled` equals `1 + siteData.pages.length`
  - `interpret(siteData).findings` is an array (may or may not include multipage findings)
  - `interpret(scrapedData)` (old shape) still returns valid result with `pages_crawled: 1`
  - `crawl('https://example.com', { maxPages: 1 })` returns `pages: []` (no inner pages)

---

## Phase 3 — API

> Requires: Phase 2 complete, T-003 (database), T-000 (framework).

- [x] **T-040** Set up Turso database client
  - `@libsql/client` installed in `api/package.json`
  - `api/db.js` rewritten — all ops async, uses `DATABASE_URL` + `DATABASE_AUTH_TOKEN` env vars
  - Falls back to `file:./data/submissions.db` (SQLite) when env vars are absent (local dev)
  - Credentials stored in `api/.env` (gitignored); see `.env.example` for shape

- [x] **T-041** Implement `submissions` table schema
  - `init()` called in `server.js` before `app.listen()`
  - `CREATE TABLE IF NOT EXISTS` + indexes run on every cold start (idempotent)

- [x] **T-042** Implement `POST /api/audit` endpoint
  - Validate: name (required), email (valid format), urls (array, 1–10)
  - Run `crawl + interpret` for each URL in parallel (`Promise.all`) — **updated from `scrape + interpret` per F-011**
  - Assemble `audit_data.json` per SPEC F-005 shape for each URL (include `pages[]` array)
  - Save each result + `data_json` to `submissions` table (T-041)
  - Return interpretation JSON per SPEC §5 (do NOT include `data_json` in response); include `pages_crawled`
  - Depends on: T-031, T-036, T-040

- [x] **T-042b** Normalise URLs before scraping in `POST /api/audit`
  - Prepend `https://` to any URL that lacks a protocol (`http://` or `https://`)
  - Applied in `api/routes/audit.js` during the `cleanUrls` mapping step
  - Ensures `devies.se` and `https://devies.se` produce identical results

- [x] **T-043** Implement partial-failure handling in `POST /api/audit`
  - If one URL fails to scrape, include error entry in results array
  - Do NOT return 500 unless ALL URLs fail
  - Per F-003 acceptance criteria

- [x] **T-044** Implement `GET /api/submissions` endpoint — **Priority: HIGH**
  - Returns all rows newest-first, **excluding** `data_json` column (too large for list)
  - Protected by `verifyJwt` middleware (T-049)
  - Depends on: T-049

- [x] **T-044b** Implement `GET /api/submissions/:id/data` endpoint — **Priority: HIGH**
  - Returns the raw `audit_data.json` for one submission (parses the `data_json` TEXT column)
  - 404 if submission not found
  - Protected by `verifyJwt` middleware (T-049)
  - Depends on: T-049

- [ ] **T-045** [TEST] API route tests
  - 400 on missing name/email
  - 400 on >10 URLs
  - 200 with valid single URL (mock scraper in tests)
  - 200 with multiple URLs
  - Submissions table has a new row after successful audit
  - `data_json` column is not null after successful audit
  - `GET /api/submissions/:id/data` returns valid JSON that parses without error
  - `GET /api/submissions` response does NOT include `data_json` field

- [x] **T-046** Rate limiting on `POST /api/audit`
  - `express-rate-limit` applied in `api/server.js` before routes
  - `/api/audit`: 5 requests/IP/hour (override via `RATE_LIMIT_MAX_AUDIT` env var)
  - `/api/submissions`: 100 requests/IP/15 min
  - Returns 429 with `{ error: '...' }` (standardHeaders: true)

- [x] **T-046b** Helmet security headers
  - `helmet` applied in `api/server.js`
  - Sets: X-Content-Type-Options, X-Frame-Options, Referrer-Policy, HSTS, X-DNS-Prefetch-Control
  - CSP disabled at middleware level (API-only server; the SPA's own CSP should be set separately)

- [x] **T-046c** SSRF prevention in `POST /api/audit`
  - `isPrivateUrl()` helper in `api/routes/audit.js` — checks hostname via `new URL()`
  - Blocks: localhost, 127.x, 10.x, 172.16–31.x, 192.168.x, 0.0.0.0, ::1, link-local 169.254.x, CGNAT 100.64–127.x
  - Malformed URLs (URL constructor throws) also blocked
  - Returns 400 before `scrape()` is called

- [x] **T-046d** Input hardening in `POST /api/audit`
  - Email validated with regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` (returns 400 on mismatch)
  - Name max 200 chars, email max 254 chars
  - Each URL max 2048 chars (oversized entries silently dropped from the list)

- [-] ~~**T-046e** API key guard~~ — **superseded by T-049 (JWT auth)**

- [x] **T-046f** Input sanitization for all user-supplied strings
  - `api/lib/sanitize.js` — three helpers: `sanitizeText`, `sanitizeCredential`, `escapeHtml`
  - `sanitizeText(str, maxLen)`: trim + strip C0/C1 control chars + strip HTML tags + truncate
  - `sanitizeCredential(str)`: strip null bytes only (preserves intended special chars in passwords)
  - `escapeHtml(str)`: escapes `& < > " '` — applied wherever user strings are interpolated into HTML
  - Applied in `api/routes/audit.js`: `name`, `email`, each URL sanitized before use
  - Applied in `api/routes/auth.js`: `username` and `password` sanitized before comparison
  - Applied in `api/services/email.js`: `url` and `summary` HTML-escaped in `buildHtml`

- [x] **T-047** Email notification after audit (F-008) — **Priority: HIGH**
  - Install `nodemailer` in `api/package.json`
  - Create `api/services/email.js` — SMTP transport configured from env vars
  - `sendAuditResult(to, url, score, grade, categorySores, summary)` function
  - HTML email template: "Here is the result for your audit request", score circle (text-based), category table
  - Plain-text fallback version of the same content
  - Called in `api/routes/audit.js` after DB save — `await` it, catch errors, log but don't re-throw
  - If `EMAIL_HOST` env var absent: skip silently (no error)
  - Add `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_FROM` to `.env.example`
  - Depends on: T-042 (audit route complete)

- [x] **T-048** Data consent checkbox (F-001 update) — **Priority: HIGH**
  - Add `consent` checkbox to `AuditForm` component (below email field)
  - Label: "I agree to my data being used to generate this audit report"
  - Submit button disabled unless checkbox checked (`disabled={!consent || submitting}`)
  - Pass `consent: true` in request body to `POST /api/audit`
  - API validation in `api/routes/audit.js`: return 400 if `consent !== true`
  - Depends on: T-050 (AuditForm component)

- [x] **T-049** Admin JWT authentication (F-009) — **Priority: HIGH**
  - Install `jsonwebtoken`, `bcrypt` in `api/package.json`
  - `api/middleware/auth.js`: verifyJwt middleware — checks `Authorization: Bearer`, returns 401 on failure
  - `POST /api/auth/login` route in `api/routes/auth.js`:
    - Compare `username` vs `ADMIN_USERNAME` env var
    - Compare `password` vs `ADMIN_PASSWORD_HASH` using `bcrypt.compare`
    - Sign and return JWT (`{ sub: username }`, expiry 8 h, secret `JWT_SECRET`)
    - Return 401 (same message for wrong user and wrong password — no enumeration)
  - Apply `verifyJwt` middleware to all `/api/submissions*` routes (remove old API key check)
  - Rate limit login endpoint: 10 requests/IP/15 min (separate limiter)
  - Add `JWT_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH` to `.env.example`
  - To generate `ADMIN_PASSWORD_HASH`: `node -e "require('bcrypt').hash('yourpassword', 12, (e,h)=>console.log(h))"`

- [x] **T-049b** Admin login frontend page (F-009) — **Priority: HIGH**
  - New page/route `/login` with `LoginForm` component
  - Fields: Username, Password; Submit button
  - On success: store token in `localStorage` as `auditAdminToken`, redirect to `/submissions`
  - On failure: inline error "Invalid credentials"
  - White background, black text, Devies-style layout (per §8.3)
  - `/submissions` route: on mount, read token from `localStorage`, verify not expired (check `exp` claim client-side), redirect to `/login` if absent or expired
  - Catch 401 on any admin API call and redirect to `/login`
  - Logout button on `/submissions` page: clear `localStorage`, redirect to `/login`
  - Depends on: T-049

---

## Phase 4 — Frontend

> Requires: T-000 (framework), T-005 (styling). API can be mocked.

- [x] **T-050** Migrate / adapt `AuditForm` component
  - Source: current `audit-web/client/src/components/AuditForm.jsx`
  - Multiple-URL mode uses a single textarea (one URL per line, up to 10) — **not** separate inputs
  - Extra lines beyond 10 are silently ignored at submit time
  - On validation or API error: form fields are preserved (AuditForm stays mounted via `display:none` during loading; `submitting` resets via `useEffect` when `error` prop changes)
  - [TODO: Add GDPR / privacy notice copy per F-001 last criterion]

- [x] **T-051** Migrate / adapt `ScoreReport` component
  - Source: current `audit-web/client/src/components/ScoreReport.jsx`
  - Shows overall score circle, category bars only — findings tab is hidden (paywall, see T-056)
  - CTA block at the bottom: "Need help improving your website health?" → mailto:hello@devies.se

- [x] **T-057** Add category tab bar to ScoreReport (F-004 update) — **Priority: HIGH**
  - Replace the current "categories grid + CTA" block inside `SiteResultCard` with a two-level tab system
  - First tab: **"Overview"** (default) — renders existing `CategoryBars` grid + CTA block (no change to this view)
  - Remaining tabs: one per active category key in `result.category_scores` (e.g. "SEO · 82", "Security · 65")
  - Tab label format: `{categoryLabel(cat)} · {score}` with the grade colour class applied to the score badge
  - Active category tab shows:
    - `<ScoreCircle score={categoryScore} />` (reuse existing component)
    - `<FindingsPanel findings={result.findings.filter(f => f.category === cat)} />`
    - Empty state "No issues found in this category" when no findings for that category
  - Tab bar uses `role="tablist"` / `role="tab"` / `role="tabpanel"` ARIA
  - Tab bar overflows horizontally on narrow viewports (`overflow-x: auto; white-space: nowrap`)
  - Active tab style: underline or fill matching the grade colour
  - Remove the `void FindingsPanel;` dead-code stub — `FindingsPanel` is now used
  - Category tab state resets to "Overview" when the site-selector tab changes (different URL selected)
  - Depends on: T-051 (ScoreReport), T-053 (theme)

- [ ] **T-056** Paywall gate for findings
  - `FindingsPanel` component already exists in `ScoreReport.jsx` (kept, not rendered)
  - When paywall is ready: add a locked section below the CTA with a prompt to unlock findings
  - On unlock: render `<FindingsPanel findings={result.findings} />`

- [x] **T-052** Migrate / adapt `App` root component (state machine)
  - States: `form` → `loading` → `results` (and back)
  - Connect to `/api/audit` via `fetch`

- [x] **T-049c** Admin submissions UI with full audit data view (F-010) — **Priority: HIGH**
  - New `SubmissionsPage` component at `/submissions`
  - Table: Date, Name, Email, URL (truncated), Score + grade badge, Platform, "View details" button
  - Paginated: 50 rows per page, Previous/Next buttons
  - Client-side filter bar: filter by email or URL substring (filter applied to current page data)
  - "View details" opens `SubmissionDetail` panel/modal for that row:
    - Calls `GET /api/submissions/:id/data` with Bearer token
    - Renders `interpretation.summary` string
    - Renders `CategoryBars` (reuse from `ScoreReport`) for `interpretation.category_scores`
    - Renders `FindingsPanel` (reuse from `ScoreReport`) for `interpretation.findings` grouped by severity
    - Collapsible "Raw metadata" section: platform signals, HTTP data, scrape timestamp
    - "Download JSON" button: `URL.createObjectURL(new Blob([json]))`, filename `audit-<id>-<hostname>.json`
  - "Logout" button in header: clears `localStorage`, redirects to `/login`
  - Empty state: "No submissions yet"
  - Depends on: T-044, T-044b, T-049b

- [x] **T-053** Apply light theme per §8.3 — **Priority: HIGH**
  - Update `index.css` with new design tokens (white bg, black text, square buttons)
  - Remove all dark-theme token values
  - Typography: system-ui font stack, 16 px body
  - Primary button: black bg, white text, no border-radius
  - Secondary button: white bg, black border
  - Apply consistently to: AuditForm, ScoreReport, LoginForm, SubmissionsPage
  - Visual reference: devies.se (white background, clean black type, minimal decoration)

- [x] **T-054** Verify iframe compatibility and security — **Priority: HIGH**
  - Test at 320 px, 480 px, 768 px widths — no horizontal scroll
  - Override Helmet's `X-Frame-Options` on the API server so the SPA can be cross-origin embedded (`frameguard: false`)
  - SPA response sets `Content-Security-Policy: frame-ancestors 'self' https://devies.se https://*.devies.se` via `vercel.json` headers
  - Confirm no `alert()`, `confirm()`, `prompt()`, `window.top`, or `window.parent` calls in client code
  - Confirm no cookies used for user-facing SPA state (use localStorage/memory only in iframe context)
  - All criteria in SPEC §8.4 ✓

- [x] **T-054b** Add Devies logo and "Site Health Checker" label to report header — **Priority: HIGH**
  - Render `<img src="https://www.devies.se/wp-content/uploads/2025/11/Devies-Group-logo.svg" alt="Devies Group" />` in the app header
  - On the line below the logo render the text "Site Health Checker"
  - Applied to all screens (AuditForm, ScoreReport, LoadingScreen) via shared `DeviesHeader` component

- [ ] **T-055** [TEST] Component tests
  - `AuditForm` renders all fields
  - `AuditForm` disables submit while loading
  - `AuditForm` shows error message when error prop provided
  - `ScoreReport` renders correct grade letter for each score band
  - `ScoreReport` renders multi-URL tabs when results.length > 1

---

## Phase 5 — Audit data retrieval (offline PDF pipeline)

> No PDF is generated by audit-web. Phase 5 is about making the saved
> `audit_data.json` easy to retrieve and use externally.

- [x] **T-060** ~~PDF generation~~ — replaced by audit_data.json persistence (done in T-042)

- [ ] **T-061** Verify `audit_data.json` compatibility with `report_generator.py`
  - Run: `python report_generator.py --input <retrieved_data.json> --out-dir ./test-out`
  - Confirm the PDF generates without errors
  - Fix any field mismatches between the assembled JSON and what `report_generator.py` expects
  - Depends on: T-044b

- [ ] **T-062** Document the offline PDF workflow in a `HOWTO-PDF.md`
  - Step 1: `GET /api/submissions` to find the submission ID
  - Step 2: `GET /api/submissions/:id/data > audit_data.json`
  - Step 3: `python site-auditor/report_generator.py --input audit_data.json --out-dir ./reports`
  - (Optional) Step 3b: send JSON to AI with prompt to produce a PDF/report

---

## Phase 6 — Deployment

> Requires: Phases 1–4 complete, Phase 0 decisions resolved.

- [x] **T-070** Set up `vercel.json`
  - For Next.js: likely no config needed
  - For Vite+Express: configure rewrites

- [ ] **T-071** [FILL] Configure environment variables in Vercel dashboard
  - Add all variables from SPEC §10.1

- [ ] **T-072** Test production build locally
  - `npm run build` (or `pnpm build`) completes without errors
  - `npm start` serves the built app
  - POST /api/audit returns results

- [ ] **T-073** Deploy to Vercel (staging)
  - Connect GitHub repo to Vercel
  - Verify POST /api/audit works from the deployed URL
  - Verify iframe embed in a test HTML page

- [ ] **T-074** [FILL] Deploy to production URL
  - Update SPEC §10 with the production domain (Q-6)

- [ ] **T-075** Smoke test production
  - Audit a known URL, verify score report renders in browser
  - Verify row appears in `GET /api/submissions`
  - Verify `GET /api/submissions/:id/data` returns valid JSON
  - Download the JSON and run `report_generator.py` locally to confirm PDF pipeline works end-to-end

---

## Phase 7 — WordPress embed

> No plugin required. The app is embedded as a plain `<iframe>` on the WordPress page.
> See SPEC §F-007 for the embed snippet and iframe security requirements.

- [-] **T-080** ~~WordPress plugin~~ — **REMOVED.** Direct `<iframe>` embed replaces the plugin approach. The `wp-plugin/` directory is no longer part of this project.

---

## Backlog / Nice-to-have (v2)

- [-] ~~**T-090** Email submission confirmation~~ — **promoted to T-047 (v1)**
- [ ] **T-091** CSV export of `submissions` table
- [ ] **T-092** Re-run audit for an existing URL (compare with last result)
- [ ] **T-093** Light mode theme
- [ ] **T-094** Real-time progress via SSE (show per-URL status while auditing)
- [ ] **T-095** AI-assisted interpretation mode (`--ai` flag equivalent)
- [ ] **T-096** Geo rules integration (copy `rules/geo.js` from site-auditor)

---

*Last updated: 2026-04-14. Update this file as tasks are completed or reprioritised.*
