'use strict';
/**
 * HTML Structure Rules
 *
 * Sources / guidelines:
 *   - HTML Living Standard (WHATWG): https://html.spec.whatwg.org/
 *   - W3C HTML5 specification
 *   - WAI-ARIA Landmark Regions: https://www.w3.org/WAI/ARIA/apg/practices/landmark-regions/
 *   - W3C: Using heading elements — https://www.w3.org/WAI/tutorials/page-structure/headings/
 *   - Google: Headings as a structural signal
 *   - HTTP Archive — Web Almanac: Markup chapter
 */

module.exports = [

  // ── Warnings ───────────────────────────────────────────────────────────────

  {
    id: 'html_heading_issues',
    category: 'HTML_Structure',
    severity: 'warning',
    weight: 15,
    title: 'Heading structure has issues',
    check: (d) => (d.html?.heading_issues?.length || 0) > 0,
    finding: (d) => {
      const issues = (d.html?.heading_issues || []).join('; ');
      return `Heading issues detected: ${issues}.`;
    },
    why: 'A logical heading hierarchy helps screen readers and search engines understand the structure and priority of content on the page. Skipping heading levels or missing headings breaks navigation for assistive technology users.',
    how_to_fix: 'Ensure headings follow a logical hierarchy: one H1 for the page title, H2 for major sections, H3 for subsections. Do not skip heading levels (e.g., going from H1 to H3). Headings should describe the content that follows them.',
    impact: 'Improved content navigation for screen reader users and clearer structure signals to search engines.',
    reference: 'W3C WAI: Headings tutorial',
  },
  {
    id: 'html_no_main',
    category: 'HTML_Structure',
    severity: 'warning',
    weight: 10,
    title: 'No <main> landmark element',
    check: (d) => d.html?.semantic?.has_main === false,
    finding: () => 'The page has no <main> element to mark the primary content area.',
    why: 'The <main> element identifies the dominant content of the page. Without it, automated tools, search engines, and assistive technologies cannot reliably identify where the page\'s primary content begins.',
    how_to_fix: 'Wrap the primary content area (between header/navigation and footer) in a <main> HTML element. Only one <main> element should exist per page.',
    impact: 'Search engines and assistive technologies can correctly identify and navigate to the main content.',
    reference: 'HTML Living Standard: <main> element',
  },
  {
    id: 'html_broken_links',
    category: 'HTML_Structure',
    severity: 'warning',
    weight: 20,
    title: 'Broken internal links found',
    check: (d) => (d.link_check?.broken_count || 0) > 0,
    finding: (d) => {
      const count   = d.link_check?.broken_count || 0;
      const sample  = (d.link_check?.broken || []).slice(0, 3).map(b => `${b.url} (${b.status})`).join(', ');
      return `${count} broken internal link(s) found${sample ? ': ' + sample : ''}.`;
    },
    why: 'Broken links create a poor user experience, and crawlers that hit broken pages cannot fully index the site. Search engines also use crawl errors as a negative quality signal.',
    how_to_fix: 'Fix or remove each broken link. If the destination page has moved, set up a 301 redirect from the old URL to the new one. Check all links in navigation, content, and footers.',
    impact: 'Better user experience, improved crawlability, and removal of a negative SEO signal.',
    reference: 'Google Search Central: Fix broken links',
  },

  // ── Info ───────────────────────────────────────────────────────────────────

  {
    id: 'html_no_nav',
    category: 'HTML_Structure',
    severity: 'info',
    weight: 5,
    title: 'No <nav> element found',
    check: (d) => d.html?.semantic?.has_nav === false,
    finding: () => 'No <nav> element was found. Navigation links appear to not be wrapped in a semantic nav element.',
    why: 'The <nav> element semantically marks navigation links, allowing screen readers to find navigation quickly and skip it if desired. It also signals site structure to search engines.',
    how_to_fix: 'Wrap primary navigation links in a <nav> element. Use aria-label to differentiate multiple nav regions (e.g., <nav aria-label="Main navigation">).',
    impact: 'Improved navigation for screen reader users and clearer site structure for search engines.',
    reference: 'HTML Living Standard: <nav> element',
  },
  {
    id: 'html_no_header',
    category: 'HTML_Structure',
    severity: 'info',
    weight: 5,
    title: 'No <header> element found',
    check: (d) => d.html?.semantic?.has_header === false,
    finding: () => 'No <header> element was found on the page.',
    why: 'The <header> element semantically identifies the page header area, helping assistive technologies and search engines understand the page structure.',
    how_to_fix: 'Wrap the page header content (logo, site name, top navigation) in a <header> element.',
    impact: 'Clearer semantic structure for assistive technologies and crawlers.',
    reference: 'HTML Living Standard: <header> element',
  },
  {
    id: 'html_no_footer',
    category: 'HTML_Structure',
    severity: 'info',
    weight: 5,
    title: 'No <footer> element found',
    check: (d) => d.html?.semantic?.has_footer === false,
    finding: () => 'No <footer> element was found on the page.',
    why: 'The <footer> element semantically marks the page footer, which often contains contact information, copyright, and secondary navigation. Semantic structure helps both users and crawlers.',
    how_to_fix: 'Wrap the page footer content in a <footer> HTML element.',
    impact: 'Improved semantic structure that helps search engines and assistive technologies understand the page layout.',
    reference: 'HTML Living Standard: <footer> element',
  },

  // ── Positive ───────────────────────────────────────────────────────────────

  {
    id: 'html_has_lang',
    category: 'HTML_Structure',
    severity: 'positive',
    weight: 0,
    title: 'Language attribute is set',
    check: (d) => !!d.html?.semantic?.lang_attr,
    finding: (d) => `The HTML lang attribute is set to "${d.html?.semantic?.lang_attr}".`,
    why: 'A correctly set language attribute ensures proper pronunciation by screen readers and correct language detection by browsers and search engines.',
    how_to_fix: 'No action required.',
    impact: 'Screen readers use the correct language and voice for page content.',
    reference: 'HTML Living Standard: lang attribute',
  },
  {
    id: 'html_semantic_complete',
    category: 'HTML_Structure',
    severity: 'positive',
    weight: 0,
    title: 'Core semantic structure in place',
    check: (d) => d.html?.semantic?.has_header && d.html?.semantic?.has_nav && d.html?.semantic?.has_footer,
    finding: () => 'The page uses <header>, <nav>, and <footer> elements for correct semantic structure.',
    why: 'Using semantic HTML elements correctly communicates page structure to browsers, assistive technologies, and search engines.',
    how_to_fix: 'No action required.',
    impact: 'Good semantic structure supports accessibility and search engine understanding.',
    reference: 'HTML Living Standard: Sectioning content',
  },
  {
    id: 'html_no_broken_links',
    category: 'HTML_Structure',
    severity: 'positive',
    weight: 0,
    title: 'No broken internal links',
    check: (d) => (d.link_check?.checked || 0) > 0 && (d.link_check?.broken_count || 0) === 0,
    finding: (d) => `All ${d.link_check?.checked} checked internal links are working correctly.`,
    why: 'Functioning links ensure visitors and search engine crawlers can navigate the site without hitting dead ends.',
    how_to_fix: 'No action required.',
    impact: 'All visitors and crawlers can navigate the site without encountering errors.',
    reference: 'Google Search Central: Fix broken links',
  },
];
