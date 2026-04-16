'use strict';
/**
 * rules/multipage.js
 *
 * Aggregate rules that analyse inner pages collected via crawl().
 * Each rule's check() receives the full siteData object { primary, pages }.
 * When called with plain scrapedData (backward compat), returns false.
 *
 * All rules check only pages[] (inner pages) — the homepage is already covered
 * by the standard 125 rules applied to primary.
 */

/**
 * Returns the inner pages array, or [] if not present.
 */
function getPages(d) {
  if (!d || !Array.isArray(d.pages) || d.pages.length === 0) return [];
  return d.pages;
}

/**
 * Summarises affected pages as a comma-delimited path list (max 5 shown).
 */
function affectedPaths(pages) {
  const paths = pages.map(p => {
    try { return new URL(p.url).pathname || '/'; } catch { return p.url; }
  });
  const shown = paths.slice(0, 5);
  const extra = paths.length - shown.length;
  return shown.join(', ') + (extra > 0 ? ` (+${extra} more)` : '');
}

module.exports = [

  // ── SEO aggregate rules ──────────────────────────────────────────────────────

  {
    id:       'multi_pages_missing_title',
    category: 'SEO',
    severity: 'warning',
    weight:   8,
    title:    'Inner pages missing title tag',
    check:  (d) => getPages(d).some(p => p.seo?.title?.missing),
    finding: (d) => {
      const bad = getPages(d).filter(p => p.seo?.title?.missing);
      return `Missing <title> on ${bad.length} inner page${bad.length > 1 ? 's' : ''}: ${affectedPaths(bad)}`;
    },
    why:        'Title tags are the primary on-page SEO signal and are displayed in search engine results.',
    how_to_fix: 'Add a unique, descriptive <title> tag (30–60 characters) to every page.',
    impact:     'Fixing missing titles can improve search visibility for those pages.',
    reference:  'https://developers.google.com/search/docs/appearance/title-link',
  },

  {
    id:       'multi_pages_title_too_long',
    category: 'SEO',
    severity: 'warning',
    weight:   4,
    title:    'Inner pages have overly long title tags',
    check:  (d) => getPages(d).some(p => p.seo?.title?.too_long),
    finding: (d) => {
      const bad = getPages(d).filter(p => p.seo?.title?.too_long);
      return `Title tag exceeds 60 characters on ${bad.length} inner page${bad.length > 1 ? 's' : ''}: ${affectedPaths(bad)}`;
    },
    why:        'Titles over 60 characters are truncated in search result snippets, reducing click-through rate.',
    how_to_fix: 'Trim title tags to 30–60 characters, keeping the most important keyword near the start.',
    impact:     'Shorter titles display fully in search results, improving click-through rate.',
    reference:  'https://developers.google.com/search/docs/appearance/title-link',
  },

  {
    id:       'multi_pages_missing_meta_desc',
    category: 'SEO',
    severity: 'warning',
    weight:   6,
    title:    'Inner pages missing meta description',
    check:  (d) => getPages(d).some(p => p.seo?.meta_description?.missing),
    finding: (d) => {
      const bad = getPages(d).filter(p => p.seo?.meta_description?.missing);
      return `Missing meta description on ${bad.length} inner page${bad.length > 1 ? 's' : ''}: ${affectedPaths(bad)}`;
    },
    why:        'Meta descriptions influence click-through rates from search results. Without one, search engines will generate their own snippet.',
    how_to_fix: 'Add a concise meta description (70–160 characters) to every page.',
    impact:     'Compelling meta descriptions improve click-through rates from search results.',
    reference:  'https://developers.google.com/search/docs/appearance/snippet',
  },

  {
    id:       'multi_pages_no_h1',
    category: 'SEO',
    severity: 'warning',
    weight:   6,
    title:    'Inner pages missing H1 heading',
    check:  (d) => getPages(d).some(p => Array.isArray(p.html?.headings?.h1) && p.html.headings.h1.length === 0),
    finding: (d) => {
      const bad = getPages(d).filter(p => Array.isArray(p.html?.headings?.h1) && p.html.headings.h1.length === 0);
      return `No H1 heading on ${bad.length} inner page${bad.length > 1 ? 's' : ''}: ${affectedPaths(bad)}`;
    },
    why:        'The H1 tag signals to search engines what the primary topic of the page is.',
    how_to_fix: 'Add one H1 tag per page that summarises the page topic and aligns with the title tag.',
    impact:     'Proper heading structure improves content crawlability and SEO relevance.',
    reference:  'https://developers.google.com/search/docs/appearance/title-link#page-titles',
  },

  // ── Accessibility aggregate rules ────────────────────────────────────────────

  {
    id:       'multi_pages_missing_alt',
    category: 'Accessibility',
    severity: 'warning',
    weight:   8,
    title:    'Inner pages have images missing alt text',
    check:  (d) => getPages(d).some(p => (p.html?.images?.missing_alt || 0) > 0),
    finding: (d) => {
      const bad = getPages(d).filter(p => (p.html?.images?.missing_alt || 0) > 0);
      const total = bad.reduce((s, p) => s + p.html.images.missing_alt, 0);
      return `${total} image${total > 1 ? 's' : ''} missing alt attribute across ${bad.length} inner page${bad.length > 1 ? 's' : ''}: ${affectedPaths(bad)}`;
    },
    why:        'Images without alt text are invisible to screen readers, failing WCAG 1.1.1 (Level A).',
    how_to_fix: 'Add descriptive alt attributes to all meaningful images. Use alt="" for decorative images.',
    impact:     'Screen reader users will be able to understand all images on the page.',
    reference:  'https://www.w3.org/WAI/WCAG21/Understanding/non-text-content.html',
  },

  {
    id:       'multi_pages_inputs_no_label',
    category: 'Accessibility',
    severity: 'warning',
    weight:   7,
    title:    'Inner pages have form inputs without labels',
    check:  (d) => getPages(d).some(p => (p.html?.forms?.total_inputs_without_label || 0) > 0),
    finding: (d) => {
      const bad = getPages(d).filter(p => (p.html?.forms?.total_inputs_without_label || 0) > 0);
      const total = bad.reduce((s, p) => s + p.html.forms.total_inputs_without_label, 0);
      return `${total} unlabelled form input${total > 1 ? 's' : ''} across ${bad.length} inner page${bad.length > 1 ? 's' : ''}: ${affectedPaths(bad)}`;
    },
    why:        'Form inputs without labels are inaccessible to screen readers, failing WCAG 1.3.1 and 3.3.2 (Level A).',
    how_to_fix: 'Associate every input with a <label for="id"> element or add an aria-label attribute.',
    impact:     'Screen reader users will be able to understand and complete all forms.',
    reference:  'https://www.w3.org/WAI/WCAG21/Understanding/labels-or-instructions.html',
  },

  {
    id:       'multi_pages_links_no_text',
    category: 'Accessibility',
    severity: 'warning',
    weight:   5,
    title:    'Inner pages have links without accessible text',
    check:  (d) => getPages(d).some(p => (p.html?.links?.empty_text_count || 0) > 0),
    finding: (d) => {
      const bad = getPages(d).filter(p => (p.html?.links?.empty_text_count || 0) > 0);
      const total = bad.reduce((s, p) => s + p.html.links.empty_text_count, 0);
      return `${total} link${total > 1 ? 's' : ''} with no accessible name across ${bad.length} inner page${bad.length > 1 ? 's' : ''}: ${affectedPaths(bad)}`;
    },
    why:        'Links without text or aria-label are meaningless to screen reader users, failing WCAG 2.4.4 (Level A).',
    how_to_fix: 'Add descriptive link text or an aria-label attribute to all links.',
    impact:     'Screen reader users can understand the purpose of every link.',
    reference:  'https://www.w3.org/WAI/WCAG21/Understanding/link-purpose-in-context.html',
  },

  {
    id:       'multi_pages_no_lang',
    category: 'Accessibility',
    severity: 'warning',
    weight:   5,
    title:    'Inner pages missing lang attribute',
    check:  (d) => getPages(d).some(p => !p.html?.semantic?.lang_attr),
    finding: (d) => {
      const bad = getPages(d).filter(p => !p.html?.semantic?.lang_attr);
      return `Missing lang attribute on <html> on ${bad.length} inner page${bad.length > 1 ? 's' : ''}: ${affectedPaths(bad)}`;
    },
    why:        'The lang attribute helps screen readers use the correct language pronunciation, required by WCAG 3.1.1 (Level A).',
    how_to_fix: 'Add lang="en" (or the appropriate language code) to the <html> element on every page.',
    impact:     'Screen readers will pronounce content correctly for users.',
    reference:  'https://www.w3.org/WAI/WCAG21/Understanding/language-of-page.html',
  },

  // ── Security aggregate rule ──────────────────────────────────────────────────

  {
    id:       'multi_pages_mixed_content',
    category: 'Security',
    severity: 'warning',
    weight:   7,
    title:    'Inner pages load mixed HTTP/HTTPS content',
    check:  (d) => getPages(d).some(p => (p.security?.mixed_content_count || 0) > 0),
    finding: (d) => {
      const bad = getPages(d).filter(p => (p.security?.mixed_content_count || 0) > 0);
      const total = bad.reduce((s, p) => s + p.security.mixed_content_count, 0);
      return `${total} mixed-content resource${total > 1 ? 's' : ''} (HTTP on HTTPS page) across ${bad.length} inner page${bad.length > 1 ? 's' : ''}: ${affectedPaths(bad)}`;
    },
    why:        'Mixed content allows attackers to intercept or modify resources loaded over HTTP, compromising HTTPS pages.',
    how_to_fix: 'Update all resource URLs to use HTTPS. Add a Content-Security-Policy: upgrade-insecure-requests header.',
    impact:     'All pages will be fully encrypted, protecting users from man-in-the-middle attacks.',
    reference:  'https://developer.mozilla.org/en-US/docs/Web/Security/Mixed_content',
  },

  // ── HTML structure aggregate rule ────────────────────────────────────────────

  {
    id:       'multi_pages_duplicate_ids',
    category: 'HTML_Structure',
    severity: 'warning',
    weight:   4,
    title:    'Inner pages have duplicate HTML IDs',
    check:  (d) => getPages(d).some(p => (p.html?.duplicate_ids_count || 0) > 0),
    finding: (d) => {
      const bad = getPages(d).filter(p => (p.html?.duplicate_ids_count || 0) > 0);
      return `Duplicate HTML IDs on ${bad.length} inner page${bad.length > 1 ? 's' : ''}: ${affectedPaths(bad)}`;
    },
    why:        'Duplicate IDs break JavaScript, CSS targeting, and ARIA references, failing WCAG 4.1.1.',
    how_to_fix: 'Ensure every id attribute value is unique within each HTML document.',
    impact:     'JavaScript and accessibility tools will work correctly across all pages.',
    reference:  'https://www.w3.org/WAI/WCAG21/Understanding/parsing.html',
  },

];
