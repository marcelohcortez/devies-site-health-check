'use strict';
/**
 * SEO Rules
 *
 * PRIMARY REFERENCE:
 *   Google Lighthouse SEO audits (chrome/lighthouse default-config.js)
 *   https://developer.chrome.com/docs/lighthouse/seo/
 *   https://github.com/GoogleChrome/lighthouse/blob/main/core/config/default-config.js
 *
 *   LIGHTHOUSE SEO SCORE STRUCTURE (10 weighted pass/fail audits):
 *     is-crawlable        weight ~31%  (dominant — noindex meta/header on the PAGE itself)
 *     document-title      weight ~7.7% (title tag exists)
 *     meta-description    weight ~7.7% (meta description exists)
 *     http-status-code    weight ~7.7% (page returns 2xx)
 *     link-text           weight ~7.7% (links have descriptive text)
 *     crawlable-anchors   weight ~7.7% (links have valid href)
 *     robots-txt          weight ~7.7% (robots.txt is parseable/valid)
 *     image-alt           weight ~7.7% (images have alt attribute — also in Accessibility)
 *     hreflang            weight ~7.7% (hreflang is valid if present)
 *     canonical           weight ~7.7% (canonical tag exists and is valid)
 *     structured-data     weight   0   (informational only — DOES NOT affect score)
 *
 *   NOT in Lighthouse SEO score:
 *     - H1 presence or count
 *     - Title length (only checks existence)
 *     - Meta description length (only checks existence)
 *     - Sitemap existence
 *     - robots.txt blocking other site paths (only checks if robots.txt is valid)
 *     - Open Graph tags
 *     - JSON-LD / structured data (informational, weight 0)
 *
 * SECONDARY REFERENCES:
 *   Google Search Central: https://developers.google.com/search/docs/
 *   Open Graph Protocol:   https://ogp.me/
 *   Schema.org:            https://schema.org/
 *
 * RULE TIERS:
 *   [LIGHTHOUSE] — maps directly to a Lighthouse SEO audit; weight reflects ~7.7% of score
 *   [EXTENDED]   — standard SEO best practice, flagged by Screaming Frog / Ahrefs / SEMrush
 *                  but NOT in Lighthouse; low weight so score stays close to Lighthouse
 */

module.exports = [

  // ── LIGHTHOUSE: document-title ─────────────────────────────────────────────

  {
    id: 'seo_title_missing',
    category: 'SEO',
    severity: 'critical',
    weight: 25,  // [LIGHTHOUSE] document-title — failure here is significant
    title: 'Page title tag is missing',
    check: (d) => d.seo?.title?.missing === true || !d.seo?.title?.text,
    finding: () => 'The page has no <title> tag.',
    why: 'The title tag is the single most important on-page SEO element. Google uses it as the headline in search results. Lighthouse marks pages without a title as failing its document-title audit.',
    how_to_fix: 'Add a <title> tag inside the <head> section. Aim for 50–60 characters including the primary keyword and brand name.',
    impact: 'Directly improves search visibility and click-through rates. Required to pass Lighthouse SEO audit.',
    reference: 'Lighthouse: document-title | Google Search Central: Title links',
  },

  // ── LIGHTHOUSE: meta-description ──────────────────────────────────────────

  {
    id: 'seo_meta_desc_missing',
    category: 'SEO',
    severity: 'warning',
    weight: 15,  // [LIGHTHOUSE] meta-description
    title: 'Meta description is missing',
    check: (d) => d.seo?.meta_description?.missing === true || !d.seo?.meta_description?.text,
    finding: () => 'The page has no <meta name="description"> tag.',
    why: 'Google shows the meta description below the title in search results. Without one, Google generates its own — often pulling an unrelated excerpt. Lighthouse flags missing meta descriptions as a failing audit.',
    how_to_fix: 'Add <meta name="description" content="..."> inside <head>. Write 140–160 characters describing the page compellingly, as if it were an advertisement.',
    impact: 'A well-written meta description can significantly increase click-through rates from search results.',
    reference: 'Lighthouse: meta-description | Google Search Central: Meta description',
  },

  // ── LIGHTHOUSE: canonical ─────────────────────────────────────────────────

  {
    id: 'seo_canonical_missing',
    category: 'SEO',
    severity: 'warning',
    weight: 10,  // [LIGHTHOUSE] canonical
    title: 'Canonical tag is missing',
    check: (d) => d.seo?.canonical?.missing === true || !d.seo?.canonical?.href,
    finding: () => 'No <link rel="canonical"> tag was found on the page.',
    why: 'Without a canonical tag, if the same page is reachable at multiple URLs (www vs non-www, HTTP vs HTTPS, trailing slash), Google may split ranking signals across duplicate versions. Lighthouse checks for a valid canonical.',
    how_to_fix: 'Add <link rel="canonical" href="https://yourdomain.com/page/"> inside <head> pointing to the preferred URL.',
    impact: 'Consolidates all ranking signals to a single URL, preventing duplicate content penalties.',
    reference: 'Lighthouse: canonical | Google Search Central: Canonical URLs',
  },

  // ── EXTENDED: H1 (not in Lighthouse, but in Screaming Frog / Ahrefs / SEMrush) ─

  {
    id: 'seo_h1_missing',
    category: 'SEO',
    severity: 'warning',
    weight: 8,   // [EXTENDED] Not in Lighthouse SEO; weight kept low to stay Lighthouse-aligned
    title: 'No H1 heading found',
    check: (d) => (d.html?.headings?.h1?.length || 0) === 0,
    finding: (d) => `The page has no H1 heading. It has ${d.html?.headings?.h2?.length || 0} H2 and ${d.html?.headings?.h3?.length || 0} H3 subheadings, but no top-level heading.`,
    why: 'While Lighthouse does not score H1 presence, Google uses the H1 as a primary signal for page topic. Missing H1 is flagged as an issue by Screaming Frog, Ahrefs, SEMrush, and most professional SEO tools.',
    how_to_fix: 'Add exactly one H1 heading near the top of the main content area that clearly describes the page topic.',
    impact: 'Improves keyword relevance signals. Flagged by all major SEO auditing platforms.',
    reference: 'Google Search Central: Headings | Ahrefs: H1 tag SEO',
  },

  // ── EXTENDED: title length (Lighthouse only checks existence, not length) ──

  {
    id: 'seo_title_too_short',
    category: 'SEO',
    severity: 'info',
    weight: 3,   // [EXTENDED] Lighthouse does not check length — kept as advisory
    title: 'Page title is too short',
    check: (d) => d.seo?.title?.too_short === true,
    finding: (d) => `The page title is ${d.seo?.title?.length || 0} characters. Google Search Central recommends 50–60 characters to make full use of search result space.`,
    why: 'A short title misses the opportunity to include descriptive keywords. Lighthouse does not score title length, but Google recommends 50–60 characters for optimal search result display.',
    how_to_fix: 'Expand the title to 50–60 characters. Include the primary keyword and brand name.',
    impact: 'More descriptive titles can improve click-through rate from search results.',
    reference: 'Google Search Central: Title tag length',
  },
  {
    id: 'seo_title_too_long',
    category: 'SEO',
    severity: 'info',
    weight: 3,   // [EXTENDED] Lighthouse does not check length — kept as advisory
    title: 'Page title is too long',
    check: (d) => d.seo?.title?.too_long === true,
    finding: (d) => `The page title is ${d.seo?.title?.length || 0} characters. Google typically truncates titles after ~60 characters in search results.`,
    why: 'Titles cut off in search results show an incomplete message. Lighthouse only checks existence, not length — this is an advisory best-practice check.',
    how_to_fix: 'Shorten the title to 50–60 characters. Keep the most important information at the start.',
    impact: 'The full title will be visible in search results, conveying a complete message to potential visitors.',
    reference: 'Google Search Central: Title tag length',
  },

  // ── EXTENDED: meta description length ─────────────────────────────────────

  {
    id: 'seo_meta_desc_too_long',
    category: 'SEO',
    severity: 'info',
    weight: 3,   // [EXTENDED] Lighthouse checks existence only — length is advisory
    title: 'Meta description is too long',
    check: (d) => d.seo?.meta_description?.too_long === true,
    finding: (d) => `The meta description is ${d.seo?.meta_description?.length || 0} characters. Google typically truncates descriptions at ~155–165 characters, cutting off the message.`,
    why: 'A truncated description delivers an incomplete message. Lighthouse only checks that a meta description exists — length is an advisory best-practice check.',
    how_to_fix: 'Rewrite the meta description to 140–160 characters. Put the most important information in the first 140 characters.',
    impact: 'A complete, visible description in search results increases click-through rate.',
    reference: 'Google Search Central: Meta description length',
  },
  {
    id: 'seo_meta_desc_too_short',
    category: 'SEO',
    severity: 'info',
    weight: 2,   // [EXTENDED]
    title: 'Meta description is very short',
    check: (d) => d.seo?.meta_description?.too_short === true,
    finding: (d) => `The meta description is only ${d.seo?.meta_description?.length || 0} characters. The recommended range is 140–160 characters.`,
    why: 'A short meta description may not provide enough information to attract clicks in search results.',
    how_to_fix: 'Expand the meta description to 140–160 characters with a clear, compelling description of the page content.',
    impact: 'A fuller description can improve click-through rates from search results.',
    reference: 'Google Search Central: Meta description',
  },

  // ── EXTENDED: H1 count ────────────────────────────────────────────────────

  {
    id: 'seo_multiple_h1',
    category: 'SEO',
    severity: 'info',
    weight: 3,   // [EXTENDED]
    title: 'Multiple H1 headings found',
    check: (d) => (d.html?.headings?.h1?.length || 0) > 1,
    finding: (d) => `The page has ${d.html?.headings?.h1?.length} H1 headings. Best practice is exactly one H1 per page.`,
    why: 'Multiple H1 tags dilute the page topic signal. Lighthouse does not check H1 count, but Google recommends one clear H1 per page.',
    how_to_fix: 'Keep exactly one H1 for the primary page topic. Change remaining H1 tags to H2 or H3.',
    impact: 'Clearer topic signal to search engines.',
    reference: 'Google Search Central: Headings structure',
  },

  // ── EXTENDED: sitemap / robots.txt best practices ─────────────────────────

  {
    id: 'seo_no_sitemap',
    category: 'SEO',
    severity: 'info',
    weight: 3,   // [EXTENDED] Lighthouse does not check sitemap existence
    title: 'No sitemap.xml found',
    check: (d) => d.seo?.sitemap?.exists === false,
    finding: () => 'No sitemap.xml was found at the standard location.',
    why: 'A sitemap helps search engines discover all pages on the site. Lighthouse does not check sitemap existence, but Google Search Central recommends having one for all sites.',
    how_to_fix: 'Create a sitemap.xml and submit it via Google Search Console. Most CMS platforms generate this automatically.',
    impact: 'Search engines can discover and index content faster and more completely.',
    reference: 'Google Search Central: Build and submit a sitemap',
  },
  {
    id: 'seo_robots_blocking',
    category: 'SEO',
    severity: 'info',
    weight: 3,   // [EXTENDED] Lighthouse robots-txt only checks validity, not content
    title: 'robots.txt may be blocking content',
    check: (d) => d.seo?.robots_txt?.blocking_important === true,
    finding: () => 'The robots.txt file contains Disallow rules that may block important content from search engine crawlers. Review to confirm all blocks are intentional.',
    why: 'Lighthouse\'s robots-txt audit only checks if robots.txt is parseable — it does not score content rules. This is an advisory check to ensure no important pages are accidentally blocked.',
    how_to_fix: 'Review robots.txt and confirm each Disallow rule is intentional. Remove any rules that block pages that should be indexed.',
    impact: 'Ensures important pages are not accidentally excluded from search results.',
    reference: 'Google Search Central: robots.txt specification',
  },
  {
    id: 'seo_sitemap_no_ref',
    category: 'SEO',
    severity: 'info',
    weight: 2,   // [EXTENDED]
    title: 'Sitemap not referenced in robots.txt',
    check: (d) => d.seo?.sitemap?.exists === true && d.seo?.robots_txt?.has_sitemap_ref === false,
    finding: () => 'A sitemap.xml exists but is not referenced in robots.txt.',
    why: 'Adding a Sitemap directive in robots.txt helps all search engine crawlers discover your sitemap automatically, not just those registered in Search Console.',
    how_to_fix: 'Add a line to robots.txt: Sitemap: https://yourdomain.com/sitemap.xml',
    impact: 'Faster sitemap discovery by all crawlers.',
    reference: 'Google Search Central: robots.txt sitemap directive',
  },

  // ── EXTENDED: Open Graph / structured data ────────────────────────────────

  {
    id: 'seo_no_og_tags',
    category: 'SEO',
    severity: 'info',
    weight: 2,   // [EXTENDED] Not in Lighthouse
    title: 'Open Graph tags missing',
    check: (d) => d.seo?.open_graph?.present === false,
    finding: () => 'No Open Graph meta tags were found.',
    why: 'Open Graph tags control how pages appear when shared on social media. Without them, shared links appear as plain text or with incorrect images.',
    how_to_fix: 'Add og:title, og:description, og:image, and og:url meta tags inside <head> for each key page.',
    impact: 'Improved appearance of social media shares, increasing click-through from social platforms.',
    reference: 'Open Graph Protocol: ogp.me',
  },
  {
    id: 'seo_no_json_ld',
    category: 'SEO',
    severity: 'info',
    weight: 2,   // [EXTENDED] Lighthouse lists structured-data as informational (weight 0)
    title: 'No structured data (JSON-LD) found',
    check: (d) => (d.seo?.json_ld?.count || 0) === 0,
    finding: () => 'No JSON-LD structured data was detected on the page.',
    why: 'Structured data unlocks rich results in Google (star ratings, FAQs, product info). Lighthouse lists structured data as informational only (does not affect its score), but it is a Google Search Central best practice.',
    how_to_fix: 'Add at minimum an Organization schema with name, logo, and contact. Consider Article, Product, or FAQPage schemas where relevant.',
    impact: 'Potential for enhanced Google search result displays that increase visibility and click-through.',
    reference: 'Google Search Central: Structured Data (informational in Lighthouse)',
  },

  // ── Positive ───────────────────────────────────────────────────────────────

  {
    id: 'seo_https_present',
    category: 'SEO',
    severity: 'positive',
    weight: 0,
    title: 'HTTPS correctly configured',
    check: (d) => d.http?.https === true,
    finding: () => 'The site uses HTTPS for all connections.',
    why: 'HTTPS is a confirmed Google ranking signal and is required for secure data transmission.',
    how_to_fix: 'No action required.',
    impact: 'Positively contributes to Google rankings and visitor trust.',
    reference: 'Google: HTTPS as a ranking signal',
  },
  {
    id: 'seo_canonical_ok',
    category: 'SEO',
    severity: 'positive',
    weight: 0,
    title: 'Canonical tag correctly configured',
    check: (d) => !!(d.seo?.canonical?.href) && d.seo?.canonical?.missing !== true,
    finding: (d) => `A canonical tag is present, pointing to ${d.seo?.canonical?.href}. Passes Lighthouse canonical audit.`,
    why: 'Canonical tags prevent duplicate content issues and consolidate ranking signals.',
    how_to_fix: 'No action required.',
    impact: 'Protects rankings from being split across duplicate URL variations.',
    reference: 'Lighthouse: canonical | Google Search Central: Canonical URLs',
  },
  {
    id: 'seo_og_complete',
    category: 'SEO',
    severity: 'positive',
    weight: 0,
    title: 'Open Graph tags fully implemented',
    check: (d) => d.seo?.open_graph?.present === true && d.seo?.open_graph?.has_title && d.seo?.open_graph?.has_image,
    finding: () => 'Open Graph tags are present with title and image defined.',
    why: 'Social media shares of this page will display correctly with a proper preview card.',
    how_to_fix: 'No action required.',
    impact: 'Every social media share benefits from an attractive preview, increasing organic reach.',
    reference: 'Open Graph Protocol: ogp.me',
  },
  {
    id: 'seo_title_ok',
    category: 'SEO',
    severity: 'positive',
    weight: 0,
    title: 'Page title is present',
    check: (d) => !!(d.seo?.title?.text) && d.seo?.title?.missing !== true,
    finding: (d) => `Page title is set: "${d.seo?.title?.text?.substring(0, 60)}". Passes Lighthouse document-title audit.`,
    why: 'A present title tag is required to pass the Lighthouse document-title SEO audit.',
    how_to_fix: 'No action required.',
    impact: 'Page is correctly indexed with a title in search results.',
    reference: 'Lighthouse: document-title',
  },
  {
    id: 'seo_meta_desc_ok',
    category: 'SEO',
    severity: 'positive',
    weight: 0,
    title: 'Meta description is present',
    check: (d) => !!(d.seo?.meta_description?.text) && d.seo?.meta_description?.missing !== true,
    finding: () => 'A meta description tag is present. Passes Lighthouse meta-description audit.',
    why: 'A present meta description passes the Lighthouse meta-description SEO audit.',
    how_to_fix: 'No action required.',
    impact: 'Google can use the meta description in search result snippets.',
    reference: 'Lighthouse: meta-description',
  },
];
