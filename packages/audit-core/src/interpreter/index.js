'use strict';
/**
 * rule-interpreter.js
 *
 * Applies static rules based on official guidelines (WCAG 2.1, Google Search Central,
 * OWASP, Lighthouse, WordPress Hardening Guide, GEO/KDD '24) to produce scored findings.
 *
 * No AI calls. No token cost. Instant.
 *
 * INPUT:  scrapedData (from scraper.js)  OR  { primary, pages } (from crawl.js)
 * OUTPUT: { overall_score, summary, category_scores, findings[], platform, mode, pages_crawled }
 *
 * SCORING:
 *   Each category starts at 100.
 *   Each failing rule deducts its `weight` from that category's score (floor: 0).
 *   Positive rules generate findings but do not affect the score.
 *   Overall score = weighted average of active category scores.
 */

const SEO_RULES           = require('../rules/seo');
const SECURITY_RULES      = require('../rules/security');
const PERFORMANCE_RULES   = require('../rules/performance');
const ACCESSIBILITY_RULES = require('../rules/accessibility');
const HTML_RULES          = require('../rules/html');
const WP_RULES            = require('../rules/wordpress');
const STRAPI_RULES        = require('../rules/strapi');
const GEO_RULES           = require('../rules/geo');
const MULTIPAGE_RULES     = require('../rules/multipage');

// GEO is always active — all homepage rules run unconditionally
const BASE_RULES = [
  ...SEO_RULES,
  ...SECURITY_RULES,
  ...PERFORMANCE_RULES,
  ...ACCESSIBILITY_RULES,
  ...HTML_RULES,
  ...WP_RULES,
  ...STRAPI_RULES,
  ...GEO_RULES,
];

// ─── CATEGORY WEIGHTS (for overall score) ────────────────────────────────────

// AI_Readiness (GEO) is always a base category — 15% weight.
// SEO and Security each drop 5% vs the old no-GEO weights.
const BASE_WEIGHTS = {
  SEO:            0.20,
  Security:       0.20,
  Performance:    0.15,
  Accessibility:  0.15,
  HTML_Structure: 0.15,
  AI_Readiness:   0.15,
};

// If WordPress, WooCommerce, or Strapi is detected, add their category to
// the mix at 10%, redistributing proportionally from all base weights.
function buildWeights(categoryScores) {
  const active = { ...BASE_WEIGHTS };
  const extra  = [];

  if ('WordPress' in categoryScores)   extra.push('WordPress');
  if ('WooCommerce' in categoryScores) extra.push('WooCommerce');
  if ('Strapi' in categoryScores)      extra.push('Strapi');

  if (extra.length === 0) return active;

  const extraWeight = 0.10 * extra.length;
  const scale       = 1 - extraWeight;
  const scaled      = Object.fromEntries(Object.entries(active).map(([k, v]) => [k, v * scale]));
  for (const cat of extra) scaled[cat] = 0.10;

  return scaled;
}

// ─── SCORE HELPERS ────────────────────────────────────────────────────────────

function computeScore(penalties) {
  return Math.max(0, Math.min(100, Math.round(100 - penalties)));
}

function scoreGrade(score) {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

// ─── SUMMARY GENERATOR ────────────────────────────────────────────────────────

function buildSummary(data, overall, categoryScores, findings) {
  const url       = data.url || 'This site';
  const criticals = findings.filter(f => f.severity === 'critical').length;
  const warnings  = findings.filter(f => f.severity === 'warning').length;
  const grade     = scoreGrade(overall);

  const worstCats = Object.entries(categoryScores)
    .filter(([, s]) => s < 60)
    .sort(([, a], [, b]) => a - b)
    .slice(0, 2)
    .map(([k]) => k.replace(/_/g, ' '));

  let issueText = '';
  if (criticals > 0 && warnings > 0) {
    issueText = ` with ${criticals} critical issue${criticals > 1 ? 's' : ''} and ${warnings} warning${warnings > 1 ? 's' : ''}`;
  } else if (criticals > 0) {
    issueText = ` with ${criticals} critical issue${criticals > 1 ? 's' : ''}`;
  } else if (warnings > 0) {
    issueText = ` with ${warnings} warning${warnings > 1 ? 's' : ''}`;
  }

  const focusText = worstCats.length > 0
    ? ` Priority areas: ${worstCats.join(' and ')}.`
    : '';

  return (
    `Automated rule-based analysis of ${url}. ` +
    `Overall score: ${overall}/100 (Grade ${grade})${issueText}. ` +
    `Findings are generated from rules based on WCAG 2.1 AA, Google Search Central, OWASP, Lighthouse, and GEO guidelines.` +
    focusText
  );
}

// ─── MAIN INTERPRET FUNCTION ──────────────────────────────────────────────────

/**
 * Interpret scraped data using static rules.
 *
 * Accepts two input shapes (backward compatible):
 *   - Plain scrapedData (FullScrapedData from scrape())
 *   - SiteData { primary: FullScrapedData, pages: LightScrapedData[] } from crawl()
 *
 * @param {object} input    - scrapedData OR { primary, pages }
 * @param {object} [options] - ignored; kept for backward compat (options.geo is no-op)
 * @returns {object}         - { overall_score, summary, category_scores, findings, platform, mode, pages_crawled }
 */
function interpret(input, options = {}) {  // eslint-disable-line no-unused-vars
  // ── Detect input shape ───────────────────────────────────────────────────
  const isSiteData   = input && typeof input === 'object' && 'primary' in input;
  const scrapedData  = isSiteData ? input.primary : input;
  const pages        = isSiteData ? (input.pages || []) : [];
  const pagesCrawled = 1 + pages.length;

  const isWP     = scrapedData.platform?.wordpress?.detected === true;
  const isWC     = scrapedData.platform?.woocommerce?.detected === true;
  const isStrapi = scrapedData.platform?.strapi?.detected === true;

  // ── Run homepage rules (all 150 — including GEO) ─────────────────────────
  const findings  = [];
  const penalties = {};   // { category: totalPenalty }

  for (const rule of BASE_RULES) {
    let fired = false;
    try {
      fired = rule.check(scrapedData);
    } catch {
      continue;
    }

    if (!fired) continue;

    let findingText = '';
    try {
      findingText = rule.finding(scrapedData);
    } catch {
      findingText = rule.title;
    }

    findings.push({
      category:   rule.category,
      severity:   rule.severity,
      title:      rule.title,
      finding:    findingText,
      why:        rule.why,
      how_to_fix: rule.how_to_fix,
      impact:     rule.impact,
      reference:  rule.reference || '',
    });

    if (rule.severity !== 'positive' && rule.weight > 0) {
      penalties[rule.category] = (penalties[rule.category] || 0) + rule.weight;
    }
  }

  // ── Run multipage aggregate rules (only when inner pages are present) ────
  if (pages.length > 0) {
    for (const rule of MULTIPAGE_RULES) {
      let fired = false;
      try {
        fired = rule.check(input);
      } catch {
        continue;
      }

      if (!fired) continue;

      let findingText = '';
      try {
        findingText = rule.finding(input);
      } catch {
        findingText = rule.title;
      }

      findings.push({
        category:   rule.category,
        severity:   rule.severity,
        title:      rule.title,
        finding:    findingText,
        why:        rule.why,
        how_to_fix: rule.how_to_fix,
        impact:     rule.impact,
        reference:  rule.reference || '',
      });

      if (rule.severity !== 'positive' && rule.weight > 0) {
        penalties[rule.category] = (penalties[rule.category] || 0) + rule.weight;
      }
    }
  }

  // ── Build category scores ────────────────────────────────────────────────
  // Active categories are strictly the known base set + detected platforms.
  // We do NOT expand by Object.keys(penalties) — that could pull unexpected
  // categories into buildWeights and silently alter the weighted average.
  const activeCategories = [
    'SEO', 'Security', 'Performance', 'Accessibility', 'HTML_Structure', 'AI_Readiness',
  ];
  if (isWP)     activeCategories.push('WordPress');
  if (isWC)     activeCategories.push('WooCommerce');
  if (isStrapi) activeCategories.push('Strapi');

  const categoryScores = {};
  for (const cat of activeCategories) {
    categoryScores[cat] = computeScore(penalties[cat] || 0);
  }

  // ── Overall score ────────────────────────────────────────────────────────
  const weights = buildWeights(categoryScores);
  let totalWeight = 0;
  let weightedSum = 0;

  for (const [cat, score] of Object.entries(categoryScores)) {
    const w = weights[cat] || 0;
    if (w === 0) continue;
    weightedSum += score * w;
    totalWeight += w;
  }

  const overall = totalWeight > 0
    ? Math.round(weightedSum / totalWeight)
    : Math.round(
        Object.values(categoryScores).reduce((s, v) => s + v, 0) /
        Math.max(Object.keys(categoryScores).length, 1)
      );

  // ── Summary ──────────────────────────────────────────────────────────────
  const summary = buildSummary(scrapedData, overall, categoryScores, findings);

  return {
    overall_score:   overall,
    summary,
    category_scores: categoryScores,
    findings,
    platform:        scrapedData.platform?.platform || 'unknown',
    mode:            'rule',
    pages_crawled:   pagesCrawled,
  };
}

module.exports = { interpret };
