'use strict';

/**
 * routes/audit.js
 *
 * POST /api/audit
 *   Body: { name, email, urls[] }
 *   - Validates input (1–10 URLs)
 *   - Runs scrape + rule-interpret in parallel for each URL
 *   - Assembles audit_data.json and saves to DB alongside submission
 *   - Returns score results to the client (no raw scrape data)
 *
 * GET /api/submissions
 *   List all submissions (no data_json — too large).
 *
 * GET /api/submissions/:id/data
 *   Returns the full audit_data.json for one submission.
 */

const express = require('express');
const router  = express.Router();

const { sanitizeText } = require('../lib/sanitize');

// ── Audit engine ──────────────────────────────────────────────────────────────

const { scrape, interpret: ruleInterpret } = require('@audit-web/audit-core');

// ── DB ────────────────────────────────────────────────────────────────────────

const { saveSubmission, listSubmissions, getSubmissionData } = require('../db');
const { sendAuditResult } = require('../services/email');
const { verifyJwt }       = require('../middleware/auth');

// ── Security helpers ──────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Returns true if the URL hostname resolves to a private/loopback address.
 * Blocks SSRF: prevents the scraper from hitting internal infrastructure.
 */
function isPrivateUrl(urlString) {
  let hostname;
  try {
    ({ hostname } = new URL(urlString));
  } catch {
    return true; // malformed URL — block it
  }
  // Strip IPv6 brackets: [::1] → ::1
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (host === 'localhost' || host === '::1') return true;
  const ipv4 = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (ipv4) {
    const [a, b] = [+ipv4[1], +ipv4[2]];
    if (a === 127)                          return true; // loopback
    if (a === 0)                            return true; // 0.0.0.0
    if (a === 10)                           return true; // RFC 1918
    if (a === 172 && b >= 16 && b <= 31)   return true; // RFC 1918
    if (a === 192 && b === 168)             return true; // RFC 1918
    if (a === 169 && b === 254)             return true; // link-local
    if (a === 100 && b >= 64 && b <= 127)  return true; // CGNAT
  }
  return false;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function runAudit(url) {
  const scrapedData = await scrape(url);

  // scrape() returns { error, ... } on fetch failure — fail closed so the
  // interpreter never scores a dead/unreachable URL as 100.
  if (scrapedData.error) {
    throw new Error(scrapedData.error);
  }

  const interpretation = ruleInterpret(scrapedData);

  // Assemble the audit_data shape — compatible with report_generator.py
  const auditData = {
    url,
    generated_at:  new Date().toISOString(),
    report_mode:   'rule',
    platform:      scrapedData.platform,
    platform_name: scrapedData.platform?.platform || 'unknown',
    http:          scrapedData.http,
    seo:           scrapedData.seo,
    performance:   scrapedData.performance,
    security:      scrapedData.security,
    html:          scrapedData.html,
    interpretation,
    token_usage:   { total_tokens: 0, total_cost_formatted: '$0.00' },
  };

  return { auditData, interpretation, url };
}

// ── Routes ────────────────────────────────────────────────────────────────────

/**
 * POST /api/audit
 */
router.post('/audit', async (req, res) => {
  const { name, email, urls, consent } = req.body;

  // ── Input validation + sanitization ─────────────────────────────────────────
  const trimName  = typeof name  === 'string' ? sanitizeText(name,  200) : '';
  const trimEmail = typeof email === 'string' ? sanitizeText(email, 254) : '';

  if (consent !== true) return res.status(400).json({ error: 'You must accept the data usage consent to request an audit.' });

  if (!trimName)  return res.status(400).json({ error: 'Name is required.' });
  if (!trimEmail) return res.status(400).json({ error: 'Email is required.' });
  if (!EMAIL_RE.test(trimEmail)) return res.status(400).json({ error: 'Invalid email address.' });

  if (!Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({ error: 'At least one URL is required.' });
  }
  if (urls.length > 10) {
    return res.status(400).json({ error: 'Maximum 10 URLs per request.' });
  }

  const cleanUrls = urls
    .map(u => (typeof u === 'string' ? sanitizeText(u, 2048) : ''))
    .filter(Boolean)
    .map(u => /^https?:\/\//i.test(u) ? u : `https://${u}`);

  if (cleanUrls.length === 0) {
    return res.status(400).json({ error: 'No valid URLs provided.' });
  }

  // ── SSRF prevention — block private/loopback addresses ───────────────────────
  const blockedUrl = cleanUrls.find(isPrivateUrl);
  if (blockedUrl) {
    return res.status(400).json({ error: 'URL points to a private or reserved address.' });
  }

  // ── Run audits in parallel — partial failure: one URL error ≠ whole request error ──
  // Attach the url to each rejection so the client knows which URL failed.
  const settled = await Promise.allSettled(
    cleanUrls.map(url =>
      runAudit(url).catch(err => {
        err.failedUrl = url;
        return Promise.reject(err);
      })
    )
  );

  // Fail entirely only when every URL failed
  const allFailed = settled.every(r => r.status === 'rejected');
  if (allFailed) {
    const firstErr = settled[0].reason;
    console.error('[Audit] All URLs failed. First error:', firstErr?.message);
    return res.status(500).json({ error: 'All URLs failed to audit. Please check the URLs and try again.' });
  }

  try {
    const responseResults = [];

    for (const result of settled) {
      if (result.status === 'rejected') {
        const reason = result.reason;
        console.error('[Audit] URL failed:', reason?.message);
        responseResults.push({
          url:   reason?.failedUrl ?? null,
          error: reason?.message  ?? 'Audit failed for this URL.',
        });
        continue;
      }

      const { auditData, interpretation, url } = result.value;

      await saveSubmission({
        name:     trimName,
        email:    trimEmail,
        url,
        score:    interpretation.overall_score,
        platform: interpretation.platform,
        dataJson: auditData,
      });

      responseResults.push({
        url,
        overall_score:   interpretation.overall_score,
        summary:         interpretation.summary,
        category_scores: interpretation.category_scores,
        findings:        interpretation.findings,
        platform:        interpretation.platform,
      });

      // ── Send result email — fail-silent ─────────────────────────────────
      sendAuditResult({
        to:             trimEmail,
        url,
        score:          interpretation.overall_score,
        categoryScores: interpretation.category_scores,
        summary:        interpretation.summary,
      }).catch(err => console.error('[email] Failed to send audit result:', err.message));
    }

    return res.json({ success: true, results: responseResults });

  } catch (err) {
    console.error('[Audit] Error:', err.message);
    return res.status(500).json({ error: `Audit failed: ${err.message}` });
  }
});

/**
 * GET /api/submissions — list (no data_json)
 */
router.get('/submissions', verifyJwt, async (_req, res) => {
  try {
    return res.json({ submissions: await listSubmissions() });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/submissions/:id/data — full audit_data.json for one row
 */
router.get('/submissions/:id/data', verifyJwt, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id.' });

  try {
    const data = await getSubmissionData(id);
    if (!data) return res.status(404).json({ error: 'Submission not found.' });
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
