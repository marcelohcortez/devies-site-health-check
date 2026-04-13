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
  - Document all variables from SPEC.md §10.1

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
  - Run `scrape + interpret` for each URL in parallel (`Promise.all`)
  - Assemble `audit_data.json` per SPEC F-005 shape for each URL
  - Save each result + `data_json` to `submissions` table (T-041)
  - Return interpretation JSON per SPEC §5 (do NOT include `data_json` in response)
  - Depends on: T-031, T-040

- [x] **T-042b** Normalise URLs before scraping in `POST /api/audit`
  - Prepend `https://` to any URL that lacks a protocol (`http://` or `https://`)
  - Applied in `api/routes/audit.js` during the `cleanUrls` mapping step
  - Ensures `devies.se` and `https://devies.se` produce identical results

- [ ] **T-043** Implement partial-failure handling in `POST /api/audit`
  - If one URL fails to scrape, include error entry in results array
  - Do NOT return 500 unless ALL URLs fail
  - Per F-003 acceptance criteria

- [ ] **T-044** Implement `GET /api/submissions` endpoint
  - Returns all rows newest-first, **excluding** `data_json` column (too large for list)
  - [FILL: Add auth/API key check per Q-7 once decided]

- [ ] **T-044b** Implement `GET /api/submissions/:id/data` endpoint
  - Returns the raw `audit_data.json` for one submission (parses the `data_json` TEXT column)
  - 404 if submission not found
  - This is the endpoint the operator uses to feed data into `report_generator.py` or AI

- [ ] **T-045** [TEST] API route tests
  - 400 on missing name/email
  - 400 on >10 URLs
  - 200 with valid single URL (mock scraper in tests)
  - 200 with multiple URLs
  - Submissions table has a new row after successful audit
  - `data_json` column is not null after successful audit
  - `GET /api/submissions/:id/data` returns valid JSON that parses without error
  - `GET /api/submissions` response does NOT include `data_json` field

- [ ] **T-046** Add rate limiting middleware
  - Depends on: T-006 (rate limiting decision)
  - [FILL: Set limits from Q-7 resolution]

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

- [ ] **T-056** Paywall gate for findings
  - `FindingsPanel` component already exists in `ScoreReport.jsx` (kept, not rendered)
  - When paywall is ready: add a locked section below the CTA with a prompt to unlock findings
  - On unlock: render `<FindingsPanel findings={result.findings} />`

- [ ] **T-052** Migrate / adapt `App` root component (state machine)
  - States: `form` → `loading` → `results` (and back)
  - Connect to `/api/audit` via `fetch`

- [ ] **T-053** Apply final styling per D-006
  - If Tailwind: install, configure `tailwind.config.ts`, migrate from `index.css`
  - If plain CSS: review and finalise `index.css` tokens from SPEC §8.3
  - [FILL: Fill in design token values in SPEC §8.3 before starting]

- [ ] **T-054** Verify iframe compatibility
  - Test at 320 px, 480 px, 768 px widths
  - No horizontal scroll
  - All criteria in SPEC §8.4 ✓

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

## Phase 7 — WordPress plugin (deferred)

> Status: **DEFERRED** — tracked here for planning only. Start after Phase 6.

- [-] **T-080** Create WordPress plugin with `[audit_tool]` shortcode
  - Embed the deployed Vercel URL as `<iframe>`
  - Settings page: server URL, height, border radius
  - Ref: existing scaffold in `audit-web/wp-plugin/` (written in v0, verify still correct)

---

## Backlog / Nice-to-have (v2)

- [ ] **T-090** Email submission confirmation to user (with score summary)
- [ ] **T-091** CSV export of `submissions` table
- [ ] **T-092** Re-run audit for an existing URL (compare with last result)
- [ ] **T-093** Light mode theme
- [ ] **T-094** Real-time progress via SSE (show per-URL status while auditing)
- [ ] **T-095** AI-assisted interpretation mode (`--ai` flag equivalent)
- [ ] **T-096** Geo rules integration (copy `rules/geo.js` from site-auditor)

---

*Last updated: [FILL: date]. Update this file as tasks are completed or reprioritised.*
