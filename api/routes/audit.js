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

// ── Audit engine ──────────────────────────────────────────────────────────────

const { scrape, interpret: ruleInterpret } = require('@audit-web/audit-core');

// ── DB ────────────────────────────────────────────────────────────────────────

const { saveSubmission, listSubmissions, getSubmissionData } = require('../db');

// ── Helpers ───────────────────────────────────────────────────────────────────

async function runAudit(url) {
  const scrapedData    = await scrape(url);
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
  const { name, email, urls } = req.body;

  if (!name?.trim() || !email?.trim()) {
    return res.status(400).json({ error: 'Name and email are required.' });
  }
  if (!Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({ error: 'At least one URL is required.' });
  }
  if (urls.length > 10) {
    return res.status(400).json({ error: 'Maximum 10 URLs per request.' });
  }

  const cleanUrls = urls
    .map(u => u.trim())
    .filter(Boolean)
    .map(u => /^https?:\/\//i.test(u) ? u : `https://${u}`);
  if (cleanUrls.length === 0) {
    return res.status(400).json({ error: 'No valid URLs provided.' });
  }

  try {
    const auditResults = await Promise.all(cleanUrls.map(runAudit));

    const responseResults = [];

    for (const { auditData, interpretation, url } of auditResults) {
      await saveSubmission({
        name:     name.trim(),
        email:    email.trim(),
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
router.get('/submissions', async (_req, res) => {
  try {
    return res.json({ submissions: await listSubmissions() });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/submissions/:id/data — full audit_data.json for one row
 */
router.get('/submissions/:id/data', async (req, res) => {
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
