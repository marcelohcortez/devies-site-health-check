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
    id:         'multi_pages_missing_title',
    category:   'SEO',
    severity:   'warning',
    weight:     8,
    title:      'Page missing title tag',
    check:  (d) => getPages(d).some(p => p.seo?.title?.missing),
    pageFilter: (p) => p.seo?.title?.missing,
    finding: (d) => {
      const bad = getPages(d).filter(p => p.seo?.title?.missing);
      return `Missing <title> tag. Every page needs a unique, descriptive title (30–60 characters).`;
    },
    why:        'Title tags are the primary on-page SEO signal and are displayed in search engine results.',
    how_to_fix: 'Add a unique, descriptive <title> tag (30–60 characters) to every page.',
    impact:     'Fixing missing titles can improve search visibility for those pages.',
    reference:  'https://developers.google.com/search/docs/appearance/title-link',
  },

  {
    id:         'multi_pages_title_too_long',
    category:   'SEO',
    severity:   'warning',
    weight:     4,
    title:      'Title tag too long',
    check:  (d) => getPages(d).some(p => p.seo?.title?.too_long),
    pageFilter: (p) => p.seo?.title?.too_long,
    finding: (d) => {
      return `Title tag exceeds 60 characters and will be truncated in search result snippets.`;
    },
    why:        'Titles over 60 characters are truncated in search result snippets, reducing click-through rate.',
    how_to_fix: 'Trim title tags to 30–60 characters, keeping the most important keyword near the start.',
    impact:     'Shorter titles display fully in search results, improving click-through rate.',
    reference:  'https://developers.google.com/search/docs/appearance/title-link',
  },

  {
    id:         'multi_pages_missing_meta_desc',
    category:   'SEO',
    severity:   'warning',
    weight:     6,
    title:      'Page missing meta description',
    check:  (d) => getPages(d).some(p => p.seo?.meta_description?.missing),
    pageFilter: (p) => p.seo?.meta_description?.missing,
    finding: (d) => {
      return `No meta description. Search engines will generate their own snippet, reducing click-through rate.`;
    },
    why:        'Meta descriptions influence click-through rates from search results. Without one, search engines will generate their own snippet.',
    how_to_fix: 'Add a concise meta description (70–160 characters) to every page.',
    impact:     'Compelling meta descriptions improve click-through rates from search results.',
    reference:  'https://developers.google.com/search/docs/appearance/snippet',
  },

  {
    id:         'multi_pages_no_h1',
    category:   'SEO',
    severity:   'warning',
    weight:     6,
    title:      'Page missing H1 heading',
    check:  (d) => getPages(d).some(p => Array.isArray(p.html?.headings?.h1) && p.html.headings.h1.length === 0),
    pageFilter: (p) => Array.isArray(p.html?.headings?.h1) && p.html.headings.h1.length === 0,
    finding: (d) => {
      return `No H1 heading found. Every page should have exactly one H1 that describes its primary topic.`;
    },
    why:        'The H1 tag signals to search engines what the primary topic of the page is.',
    how_to_fix: 'Add one H1 tag per page that summarises the page topic and aligns with the title tag.',
    impact:     'Proper heading structure improves content crawlability and SEO relevance.',
    reference:  'https://developers.google.com/search/docs/appearance/title-link#page-titles',
  },

  // ── Accessibility aggregate rules ────────────────────────────────────────────

  {
    id:         'multi_pages_missing_alt',
    category:   'Accessibility',
    severity:   'warning',
    weight:     8,
    title:      'Images missing alt text',
    check:  (d) => getPages(d).some(p => (p.html?.images?.missing_alt || 0) > 0),
    pageFilter: (p) => (p.html?.images?.missing_alt || 0) > 0,
    finding: (d, page) => {
      const n = page?.html?.images?.missing_alt || 0;
      return `${n} image${n !== 1 ? 's' : ''} missing alt attribute. Screen readers cannot convey these images to visually impaired users (WCAG 1.1.1).`;
    },
    why:        'Images without alt text are invisible to screen readers, failing WCAG 1.1.1 (Level A).',
    how_to_fix: 'Add descriptive alt attributes to all meaningful images. Use alt="" for decorative images.',
    impact:     'Screen reader users will be able to understand all images on the page.',
    reference:  'https://www.w3.org/WAI/WCAG21/Understanding/non-text-content.html',
  },

  {
    id:         'multi_pages_inputs_no_label',
    category:   'Accessibility',
    severity:   'warning',
    weight:     7,
    title:      'Form inputs without labels',
    check:  (d) => getPages(d).some(p => (p.html?.forms?.total_inputs_without_label || 0) > 0),
    pageFilter: (p) => (p.html?.forms?.total_inputs_without_label || 0) > 0,
    finding: (d, page) => {
      const n = page?.html?.forms?.total_inputs_without_label || 0;
      return `${n} form input${n !== 1 ? 's' : ''} without associated labels. Screen reader users cannot determine the purpose of these fields (WCAG 1.3.1).`;
    },
    why:        'Form inputs without labels are inaccessible to screen readers, failing WCAG 1.3.1 and 3.3.2 (Level A).',
    how_to_fix: 'Associate every input with a <label for="id"> element or add an aria-label attribute.',
    impact:     'Screen reader users will be able to understand and complete all forms.',
    reference:  'https://www.w3.org/WAI/WCAG21/Understanding/labels-or-instructions.html',
  },

  {
    id:         'multi_pages_links_no_text',
    category:   'Accessibility',
    severity:   'warning',
    weight:     5,
    title:      'Links without accessible text',
    check:  (d) => getPages(d).some(p => (p.html?.links?.empty_text_count || 0) > 0),
    pageFilter: (p) => (p.html?.links?.empty_text_count || 0) > 0,
    finding: (d, page) => {
      const n = page?.html?.links?.empty_text_count || 0;
      return `${n} link${n !== 1 ? 's' : ''} with no text or aria-label. Screen reader users cannot determine link purpose (WCAG 2.4.4).`;
    },
    why:        'Links without text or aria-label are meaningless to screen reader users, failing WCAG 2.4.4 (Level A).',
    how_to_fix: 'Add descriptive link text or an aria-label attribute to all links.',
    impact:     'Screen reader users can understand the purpose of every link.',
    reference:  'https://www.w3.org/WAI/WCAG21/Understanding/link-purpose-in-context.html',
  },

  {
    id:         'multi_pages_no_lang',
    category:   'Accessibility',
    severity:   'warning',
    weight:     5,
    title:      'Page missing lang attribute',
    check:  (d) => getPages(d).some(p => !p.html?.semantic?.lang_attr),
    pageFilter: (p) => !p.html?.semantic?.lang_attr,
    finding: (d) => {
      return `Missing lang attribute on <html>. Screen readers need this to use correct language pronunciation (WCAG 3.1.1).`;
    },
    why:        'The lang attribute helps screen readers use the correct language pronunciation, required by WCAG 3.1.1 (Level A).',
    how_to_fix: 'Add lang="en" (or the appropriate language code) to the <html> element on every page.',
    impact:     'Screen readers will pronounce content correctly for users.',
    reference:  'https://www.w3.org/WAI/WCAG21/Understanding/language-of-page.html',
  },

  // ── Security aggregate rule ──────────────────────────────────────────────────

  {
    id:         'multi_pages_mixed_content',
    category:   'Security',
    severity:   'warning',
    weight:     7,
    title:      'Page loads mixed HTTP/HTTPS content',
    check:  (d) => getPages(d).some(p => (p.security?.mixed_content_count || 0) > 0),
    pageFilter: (p) => (p.security?.mixed_content_count || 0) > 0,
    finding: (d, page) => {
      const n = page?.security?.mixed_content_count || 0;
      return `${n} resource${n !== 1 ? 's' : ''} loaded over HTTP on an HTTPS page. Attackers can intercept or modify these resources.`;
    },
    why:        'Mixed content allows attackers to intercept or modify resources loaded over HTTP, compromising HTTPS pages.',
    how_to_fix: 'Update all resource URLs to use HTTPS. Add a Content-Security-Policy: upgrade-insecure-requests header.',
    impact:     'All pages will be fully encrypted, protecting users from man-in-the-middle attacks.',
    reference:  'https://developer.mozilla.org/en-US/docs/Web/Security/Mixed_content',
  },

  // ── HTML structure aggregate rule ────────────────────────────────────────────

  {
    id:         'multi_pages_duplicate_ids',
    category:   'HTML_Structure',
    severity:   'warning',
    weight:     4,
    title:      'Page has duplicate HTML IDs',
    check:  (d) => getPages(d).some(p => (p.html?.duplicate_ids_count || 0) > 0),
    pageFilter: (p) => (p.html?.duplicate_ids_count || 0) > 0,
    finding: (d, page) => {
      const n = page?.html?.duplicate_ids_count || 0;
      return `${n} duplicate ID${n !== 1 ? 's' : ''} found. Duplicate IDs break JavaScript, CSS targeting, and ARIA references (WCAG 4.1.1).`;
    },
    why:        'Duplicate IDs break JavaScript, CSS targeting, and ARIA references, failing WCAG 4.1.1.',
    how_to_fix: 'Ensure every id attribute value is unique within each HTML document.',
    impact:     'JavaScript and accessibility tools will work correctly across all pages.',
    reference:  'https://www.w3.org/WAI/WCAG21/Understanding/parsing.html',
  },

];
