'use strict';
/**
 * Accessibility Rules (WCAG 2.1 / 2.2, ADA, EAA / EN 301 549, Section 508, AODA)
 *
 * Sources / guidelines:
 *   - WCAG 2.1 (W3C Recommendation): https://www.w3.org/TR/WCAG21/
 *   - WCAG 2.2 (W3C Recommendation): https://www.w3.org/TR/WCAG22/
 *   - WAI-ARIA Authoring Practices: https://www.w3.org/WAI/ARIA/apg/
 *   - EN 301 549 v3.2.1 (European Accessibility Standard for ICT — basis for EAA):
 *       https://www.etsi.org/deliver/etsi_en/301500_301599/301549/03.02.01_60/en_301549v030201p.pdf
 *   - ADA Title II Final Rule (2024): https://www.ada.gov/resources/2024-03-08-web-rule/
 *   - Section 508 (US Federal): https://www.section508.gov/develop/applicability-conformance/
 *   - AODA IASR Section 14 (Ontario): https://accessiblecampus.ca/tools-resources/
 *   - W3C: Using language attributes — https://www.w3.org/WAI/WCAG21/Techniques/html/H57
 *   - W3C: Providing text alternatives for non-text content (Success Criterion 1.1.1)
 *   - W3C: Labels or instructions for form inputs (Success Criterion 1.3.1 / 3.3.2)
 *   - W3C: Headings and Labels (Success Criterion 2.4.6)
 *   - ARIA Landmark Roles: https://www.w3.org/WAI/ARIA/apg/practices/landmark-regions/
 */

module.exports = [

  // ── Critical ───────────────────────────────────────────────────────────────

  {
    id: 'a11y_page_title_missing',
    category: 'Accessibility',
    severity: 'critical',
    weight: 15,
    title: 'Page <title> element missing',
    check: (d) => d.seo?.title?.missing === true,
    finding: () => 'The page has no <title> element.',
    why: 'Screen reader users rely on the page title to identify the page — it is the first thing announced when a page loads. Without a title, users cannot distinguish between different browser tabs or identify where they are in a site. This is a WCAG 2.1 Level A failure (Success Criterion 2.4.2).',
    how_to_fix: 'Add a descriptive <title> element inside the <head>. The title should clearly describe the page purpose, ideally following the pattern "Page Name — Site Name". Every page should have a unique, descriptive title.',
    impact: 'Screen reader users can identify pages, and search engines correctly index the site.',
    reference: 'WCAG 2.1 Success Criterion 2.4.2: Page Titled (Level A) — https://www.w3.org/TR/WCAG21/#page-titled',
  },
  {
    id: 'a11y_images_missing_alt',
    category: 'Accessibility',
    severity: 'critical',
    weight: 25,
    title: 'Images missing alt text',
    check: (d) => (d.html?.images?.missing_alt || 0) > 0,
    finding: (d) => `${d.html?.images?.missing_alt} of ${d.html?.images?.total} image(s) have no alt attribute at all.`,
    why: 'Images without alt text are completely inaccessible to screen reader users. This is a WCAG 2.1 Level A failure (Success Criterion 1.1.1), the most fundamental accessibility requirement. It also creates legal compliance risk in regions with digital accessibility laws.',
    how_to_fix: 'Add an alt attribute to every <img> tag. For images conveying information, write a short description (5–15 words) of what the image shows. For purely decorative images, use alt="" (empty alt, which tells screen readers to skip the image).',
    impact: 'Makes the page usable for visitors relying on screen readers and compliant with WCAG 2.1 Level A.',
    reference: 'WCAG 2.1 Success Criterion 1.1.1: Non-text Content (Level A)',
  },
  {
    id: 'a11y_no_lang',
    category: 'Accessibility',
    severity: 'critical',
    weight: 20,
    title: 'Language attribute missing on <html>',
    check: (d) => !d.html?.semantic?.lang_attr,
    finding: () => 'No lang attribute was found on the <html> element.',
    why: 'Without a language attribute, screen readers cannot determine which language to use for pronunciation, causing garbled or incorrect speech output for all users relying on assistive technology. This is a WCAG 2.1 Level A failure (Success Criterion 3.1.1).',
    how_to_fix: 'Add the lang attribute to the opening <html> tag. Example: <html lang="sv"> for Swedish, <html lang="en"> for English. Use valid BCP 47 language codes.',
    impact: 'Screen readers can correctly pronounce content in the right language, making the page accessible to users of assistive technologies.',
    reference: 'WCAG 2.1 Success Criterion 3.1.1: Language of Page (Level A)',
  },
  {
    id: 'a11y_inputs_no_label',
    category: 'Accessibility',
    severity: 'critical',
    weight: 20,
    title: 'Form inputs without labels',
    check: (d) => (d.html?.forms?.total_inputs_without_label || 0) > 0,
    finding: (d) => `${d.html?.forms?.total_inputs_without_label} form input(s) have no associated label.`,
    why: 'Form inputs without labels are unusable for screen reader users, who cannot tell what information is expected in each field. This is a WCAG 2.1 Level A failure (Success Criterion 1.3.1 and 3.3.2).',
    how_to_fix: 'Add a <label> element for every input, either using the for/id association or wrapping the input inside the label. Alternatively, use aria-label or aria-labelledby for programmatic labels.',
    impact: 'Forms become accessible to screen reader users, expanding your reachable audience and meeting legal compliance requirements.',
    reference: 'WCAG 2.1 Success Criterion 1.3.1: Info and Relationships (Level A) / 3.3.2: Labels or Instructions (Level A)',
  },

  {
    id: 'a11y_links_no_text',
    category: 'Accessibility',
    severity: 'critical',
    weight: 20,
    title: 'Links with no accessible name',
    check: (d) => (d.html?.links?.empty_text_count || 0) > 0,
    finding: (d) => `${d.html?.links?.empty_text_count} link(s) have no text content, aria-label, or title attribute and cannot be identified by screen reader users.`,
    why: 'Links with no accessible name are announced as "link" with no destination description, making them completely useless to screen reader users. This is a WCAG 2.1 Level A failure (Success Criterion 2.4.4: Link Purpose) and one of the most common barriers to accessibility.',
    how_to_fix: 'Ensure every <a> element has descriptive text content, an aria-label attribute, or a title attribute. For icon-only links, add aria-label="Go to contact page" or similar. For image links, ensure the image has a non-empty alt attribute.',
    impact: 'Screen reader users can understand the destination and purpose of every link on the page.',
    reference: 'WCAG 2.1 Success Criterion 2.4.4: Link Purpose (Level A) — https://www.w3.org/TR/WCAG21/#link-purpose-in-context',
  },
  {
    id: 'a11y_iframes_no_title',
    category: 'Accessibility',
    severity: 'critical',
    weight: 15,
    title: 'Iframes missing title attribute',
    check: (d) => (d.html?.iframes_without_title || 0) > 0,
    finding: (d) => `${d.html?.iframes_without_title} iframe(s) have no title attribute, making their purpose unidentifiable to screen reader users.`,
    why: 'Screen readers announce iframes by their title attribute. Without a title, users have no way to understand what an iframe contains and must enter it blindly. This is a WCAG 2.1 Level A failure (Success Criterion 2.4.1 — technique H64).',
    how_to_fix: 'Add a descriptive title attribute to every <iframe>: <iframe title="YouTube video: Product Overview" src="...">. For iframes that are purely decorative or contain no meaningful content, add title="decorative" and aria-hidden="true".',
    impact: 'Screen reader users can understand the purpose of every embedded frame before navigating into it.',
    reference: 'WCAG 2.1 H64: Using the title attribute of the iframe element — https://www.w3.org/WAI/WCAG21/Techniques/html/H64',
  },
  {
    id: 'a11y_video_no_captions',
    category: 'Accessibility',
    severity: 'critical',
    weight: 20,
    title: 'Video elements missing captions track',
    check: (d) => (d.html?.video_without_captions || 0) > 0,
    finding: (d) => `${d.html?.video_without_captions} <video> element(s) have no <track kind="captions"> or <track kind="subtitles"> child element.`,
    why: 'Video without captions is completely inaccessible to deaf and hard-of-hearing users, and to anyone in a sound-sensitive environment. This is a WCAG 2.1 Level A failure (Success Criterion 1.2.2: Captions — Prerecorded). It is also a legal compliance requirement under many accessibility laws including the ADA and EN 301 549.',
    how_to_fix: 'Add a <track> element inside each <video>: <track kind="captions" src="captions-en.vtt" srclang="en" label="English" default>. Create a WebVTT (.vtt) caption file for each video. For embedded YouTube/Vimeo videos, ensure captions are enabled in the embed settings.',
    impact: 'Makes all video content accessible to deaf and hard-of-hearing users, and enables full legal accessibility compliance.',
    reference: 'WCAG 2.1 Success Criterion 1.2.2: Captions (Prerecorded) Level A — https://www.w3.org/TR/WCAG21/#captions-prerecorded',
  },
  {
    id: 'a11y_audio_autoplay',
    category: 'Accessibility',
    severity: 'critical',
    weight: 15,
    title: 'Audio plays automatically without visible controls',
    check: (d) => (d.html?.audio_autoplay_no_controls || 0) > 0,
    finding: (d) => `${d.html?.audio_autoplay_no_controls} <audio autoplay> element(s) have no controls attribute, giving users no way to pause or mute.`,
    why: 'Auto-playing audio without controls prevents screen reader users from hearing their AT announcements — the site audio drowns out the screen reader. It also creates a disorienting experience for users with cognitive disabilities, and can cause physical discomfort. This is a WCAG 2.1 Level A failure (Success Criterion 1.4.2: Audio Control).',
    how_to_fix: 'Either remove the autoplay attribute entirely, or add the controls attribute to give users a pause/mute button: <audio autoplay controls src="...">. Better yet, remove autoplay and let users initiate playback. If autoplay is required, it must be muted by default (add muted attribute).',
    impact: 'Screen reader users can hear their assistive technology, and all users have control over unexpected audio.',
    reference: 'WCAG 2.1 Success Criterion 1.4.2: Audio Control (Level A) — https://www.w3.org/TR/WCAG21/#audio-control',
  },
  {
    id: 'a11y_duplicate_ids',
    category: 'Accessibility',
    severity: 'critical',
    weight: 15,
    title: 'Duplicate ID attributes detected',
    check: (d) => (d.html?.duplicate_ids_count || 0) > 0,
    finding: (d) => `${d.html?.duplicate_ids_count} duplicate ID value(s) found. Duplicate IDs break label associations, ARIA references, and skip links.`,
    why: 'HTML ID attributes must be unique per page. Duplicate IDs break form label associations (<label for="id">), ARIA attributes (aria-labelledby, aria-describedby, aria-controls), and skip links (#main). When IDs are duplicated, browsers and assistive technologies use only the first match, silently breaking all subsequent references. This is a WCAG 2.1 Level A failure (Success Criterion 4.1.1: Parsing).',
    how_to_fix: 'Audit the page for duplicate id attributes using browser DevTools (document.querySelectorAll) or an HTML validator. Each id value must appear exactly once per page. This is especially common when JavaScript renders lists of components using the same template — ensure unique IDs are generated for each instance.',
    impact: 'Restores correct operation of label associations, ARIA references, and skip navigation links.',
    reference: 'WCAG 2.1 Success Criterion 4.1.1: Parsing (Level A) — https://www.w3.org/TR/WCAG21/#parsing',
  },

  // ── Warnings ───────────────────────────────────────────────────────────────

  {
    id: 'a11y_heading_hierarchy',
    category: 'Accessibility',
    severity: 'warning',
    weight: 12,
    title: 'Heading structure is broken or flat',
    check: (d) => {
      const issues = d.html?.heading_issues || [];
      return issues.some(i => i.includes('No H2') || i.includes('No H1'));
    },
    finding: (d) => {
      const issues = d.html?.heading_issues || [];
      return `Heading structure issue(s) detected: ${issues.join('; ')}.`;
    },
    why: 'Screen reader users navigate pages using heading structure as an outline. A flat or broken heading hierarchy (e.g., jumping from H1 to H3, or having no H2 headings) makes it impossible to navigate content efficiently. This relates to WCAG 2.1 Success Criterion 1.3.1 and 2.4.6.',
    how_to_fix: 'Ensure headings follow a logical hierarchy: one H1 (the main page heading), followed by H2 for major sections, then H3 for subsections, and so on. Never skip heading levels. Use CSS to control visual styling — do not choose heading levels based on appearance.',
    impact: 'Screen reader users can navigate the page efficiently using headings as an outline of the content.',
    reference: 'WCAG 2.1 Success Criterion 2.4.6: Headings and Labels (Level AA) — https://www.w3.org/TR/WCAG21/#headings-and-labels',
  },
  {
    id: 'a11y_multiple_h1',
    category: 'Accessibility',
    severity: 'warning',
    weight: 8,
    title: 'Multiple H1 headings on the page',
    check: (d) => (d.html?.headings?.h1?.length || 0) > 1,
    finding: (d) => `The page has ${d.html?.headings?.h1?.length} H1 elements. There should be exactly one.`,
    why: 'The H1 is the primary page heading and should appear exactly once. Multiple H1 elements confuse both screen reader users navigating by headings and search engines trying to understand the primary topic of the page. This relates to WCAG 2.4.6.',
    how_to_fix: 'Identify the single most important heading on the page and mark it as H1. Change all other H1 elements to appropriate lower-level headings (H2, H3, etc.) based on their position in the content hierarchy.',
    impact: 'Clearer page structure for both assistive technology users and search engines.',
    reference: 'WCAG 2.1 Success Criterion 2.4.6: Headings and Labels (Level AA) — https://www.w3.org/TR/WCAG21/#headings-and-labels',
  },
  {
    id: 'a11y_images_empty_alt',
    category: 'Accessibility',
    severity: 'warning',
    weight: 10,
    title: 'Images with empty alt text',
    check: (d) => (d.html?.images?.empty_alt || 0) > 0,
    finding: (d) => `${d.html?.images?.empty_alt} image(s) have empty alt text (alt=""). This is correct for purely decorative images but should be verified.`,
    why: 'If any of these images convey meaning (a product photo, a team member, an infographic), screen reader users lose access to that information. Empty alt is only correct for purely decorative images.',
    how_to_fix: 'Review each image with alt="". If it conveys information or context, add a descriptive alt text. Only images that are purely decorative (background shapes, dividers) should have alt="".',
    impact: 'Ensures all meaningful images are accessible to visually impaired users.',
    reference: 'WCAG 2.1 Success Criterion 1.1.1: Non-text Content (Level A)',
  },
  {
    id: 'a11y_no_skip_link',
    category: 'Accessibility',
    severity: 'warning',
    weight: 12,
    title: 'No skip navigation link detected',
    check: (d) => d.html?.semantic?.has_skip_link === false,
    finding: () => 'The page has no "skip to main content" link, requiring keyboard and screen reader users to navigate through all header and navigation content on every page load.',
    why: 'Without a skip link, keyboard-only users and screen reader users must Tab through every navigation item, logo, and header element on every page before reaching the main content. On navigation-heavy pages this can mean 30+ Tab presses just to reach the first paragraph. This is a WCAG 2.1 Level A requirement (Success Criterion 2.4.1: Bypass Blocks).',
    how_to_fix: 'Add a skip link as the very first element in the <body>: <a class="skip-link" href="#main-content">Skip to main content</a>. Then add id="main-content" to your <main> element. Style the link to be visually hidden until focused: .skip-link { position: absolute; left: -9999px; } .skip-link:focus { left: 0; }.',
    impact: 'Keyboard-only users can bypass navigation blocks and reach main content immediately, dramatically improving usability.',
    reference: 'WCAG 2.1 Success Criterion 2.4.1: Bypass Blocks (Level A) — https://www.w3.org/TR/WCAG21/#bypass-blocks',
  },
  {
    id: 'a11y_autocomplete_missing',
    category: 'Accessibility',
    severity: 'warning',
    weight: 8,
    title: 'Form inputs collecting personal data missing autocomplete',
    check: (d) => {
      const forms = d.html?.forms?.forms_list || [];
      return forms.some(f =>
        (f.inputs || []).some(i => {
          const t = (i.type || '').toLowerCase();
          const n = (i.name || '').toLowerCase();
          if (t === 'hidden' || t === 'submit' || t === 'button') return false;
          const isPersonal = t === 'email' || t === 'tel' ||
            n.includes('email') || n.includes('phone') || n.includes('name') ||
            n.includes('address') || n.includes('postcode') || n.includes('zip') ||
            n.includes('city') || n.includes('country');
          return isPersonal && !i.autocomplete;
        })
      );
    },
    finding: () => 'Form inputs collecting personal data (email, phone, name, address) appear to be missing the autocomplete attribute, making them harder to use for people with cognitive disabilities or motor impairments.',
    why: 'The autocomplete attribute allows browsers and assistive technologies to auto-fill form fields with stored personal data, which is critical for users with cognitive disabilities, motor impairments, or those who struggle with repetitive data entry. Omitting it on personal data fields is a WCAG 2.1 Level AA failure (Success Criterion 1.3.5: Identify Input Purpose).',
    how_to_fix: 'Add the autocomplete attribute to all inputs collecting personal data: <input type="email" autocomplete="email">, <input type="text" name="name" autocomplete="name">, <input type="tel" autocomplete="tel">. See the full list of valid autocomplete values at MDN.',
    impact: 'Users with cognitive disabilities and motor impairments can use browser autofill to complete forms faster and with fewer errors.',
    reference: 'WCAG 2.1 Success Criterion 1.3.5: Identify Input Purpose (Level AA) — https://www.w3.org/TR/WCAG21/#identify-input-purpose',
  },
  {
    id: 'a11y_no_main_landmark',
    category: 'Accessibility',
    severity: 'warning',
    weight: 10,
    title: 'No <main> landmark element',
    check: (d) => d.html?.semantic?.has_main === false,
    finding: () => 'The page has no <main> element to identify the primary content area.',
    why: 'Screen reader users rely on landmark roles to navigate pages efficiently. Without <main>, they cannot quickly jump to the main content and must listen through all navigation and header content first.',
    how_to_fix: 'Wrap the primary page content (the area between the header/navigation and footer) in a <main> HTML element. This is a minor HTML change with no visual impact.',
    impact: 'Screen reader users can navigate directly to the main content, significantly improving the experience for assistive technology users.',
    reference: 'WCAG 2.1 Success Criterion 1.3.6: Identify Purpose (Level AAA) / WAI-ARIA Landmark Regions',
  },
  {
    id: 'a11y_aria_issues',
    category: 'Accessibility',
    severity: 'warning',
    weight: 10,
    title: 'ARIA usage issues detected',
    check: (d) => (d.html?.aria_issues?.length || 0) > 0,
    finding: (d) => `${d.html?.aria_issues?.length} ARIA issue(s) were detected: ${(d.html?.aria_issues || []).slice(0, 3).join('; ')}.`,
    why: 'Incorrect ARIA usage can make pages worse for screen reader users than having no ARIA at all. Misused roles and attributes create confusion and broken navigation for assistive technology.',
    how_to_fix: 'Review each ARIA issue and either correct the attribute usage or remove ARIA if it is unnecessary. Follow the WAI-ARIA Authoring Practices for correct patterns.',
    impact: 'Correct ARIA usage improves the assistive technology experience and ensures screen readers interpret the page correctly.',
    reference: 'WCAG 2.1 Success Criterion 4.1.2: Name, Role, Value (Level A)',
  },

  // ── Critical (ADA / EAA / WCAG 2.1 gaps) ─────────────────────────────────

  {
    id: 'a11y_viewport_blocks_zoom',
    category: 'Accessibility',
    severity: 'critical',
    weight: 20,
    title: 'Viewport meta tag blocks user zoom',
    check: (d) => d.html?.semantic?.viewport_blocks_zoom === true,
    finding: () => 'The <meta name="viewport"> tag contains user-scalable=no or maximum-scale=1, preventing users from zooming the page.',
    why: 'Blocking zoom prevents users with low vision from enlarging text to a readable size. It is one of the most common and impactful mobile accessibility failures. This violates WCAG 2.1 SC 1.4.4 Resize Text (Level AA), ADA Title II/III, EAA/EN 301 549 Clause 11.7, Section 508, and AODA.',
    how_to_fix: 'Remove user-scalable=no and any maximum-scale value of 1 or less from the <meta name="viewport"> tag. A safe viewport tag is: <meta name="viewport" content="width=device-width, initial-scale=1">.',
    impact: 'Users with low vision can zoom the page up to 200% or more, dramatically improving readability on mobile devices.',
    reference: 'WCAG 2.1 SC 1.4.4: Resize Text (Level AA) — https://www.w3.org/TR/WCAG21/#resize-text | EN 301 549 v3.2.1 Clause 11.7',
  },
  {
    id: 'a11y_meta_refresh_redirect',
    category: 'Accessibility',
    severity: 'critical',
    weight: 15,
    title: 'Auto-redirect via <meta http-equiv="refresh">',
    check: (d) => d.html?.meta_refresh_redirect === true,
    finding: () => 'The page uses <meta http-equiv="refresh"> with a timed redirect, moving users away without their control.',
    why: 'Automatic page redirects disrupt screen reader users mid-session, force keyboard users to lose their place, and can disorient users with cognitive disabilities. This violates WCAG 2.1 SC 2.2.1 Timing Adjustable (Level A), which requires users to be able to turn off, adjust, or extend time limits. All accessibility laws — ADA, EAA, Section 508, AODA — inherit this requirement.',
    how_to_fix: 'Replace the meta refresh tag with a server-side redirect (HTTP 301/302) for permanent redirects. If the intent is to display a "you will be redirected" message, provide a manual link instead and remove the automatic redirect.',
    impact: 'Users are in control of navigation and are not unexpectedly moved to a different page.',
    reference: 'WCAG 2.1 SC 2.2.1: Timing Adjustable (Level A) — https://www.w3.org/TR/WCAG21/#timing-adjustable',
  },
  {
    id: 'a11y_tables_no_headers',
    category: 'Accessibility',
    severity: 'critical',
    weight: 15,
    title: 'Data tables missing header markup',
    check: (d) => (d.html?.tables_without_headers || 0) > 0,
    finding: (d) => `${d.html?.tables_without_headers} table(s) have no <th> elements, scope attributes, or <caption>, making their data structure inaccessible to screen readers.`,
    why: 'Screen readers rely on <th> elements (or scope attributes) to announce column and row headers as users navigate table cells. Without headers, every cell is read in isolation with no context of what it represents. This violates WCAG 2.1 SC 1.3.1 Info and Relationships (Level A) — a requirement shared by all accessibility laws: ADA, EAA/EN 301 549, Section 508, and AODA.',
    how_to_fix: 'For each data table, add <th scope="col"> for column headers and <th scope="row"> for row headers. Add a <caption> to describe the table purpose. For simple tables, at minimum add <th> to the first row. Avoid using tables purely for visual layout.',
    impact: 'Screen reader users can understand tabular data structure and navigate it efficiently by headers.',
    reference: 'WCAG 2.1 SC 1.3.1: Info and Relationships (Level A) — https://www.w3.org/TR/WCAG21/#info-and-relationships',
  },

  // ── Warnings (EAA / WCAG 2.2 / ADA additions) ─────────────────────────────

  {
    id: 'a11y_no_accessibility_statement',
    category: 'Accessibility',
    severity: 'warning',
    weight: 8,
    title: 'No accessibility statement link found',
    check: (d) => d.html?.semantic?.accessibility_statement_link === false,
    finding: () => 'No link to an accessibility statement or accessibility policy was detected on this page.',
    why: 'The European Accessibility Act (EAA / EN 301 549), the EU Web Accessibility Directive (2016/2102), and Section 508 for federal agencies all mandate a published, linked accessibility statement on every page of a website. The statement must describe the accessibility level achieved, known barriers, and contact information for reporting issues. Without it, legal compliance cannot be demonstrated.',
    how_to_fix: 'Create a dedicated accessibility statement page (e.g., /accessibility-statement) that follows the W3C accessibility statement template. Add a visible link to it from the footer of every page, with anchor text such as "Accessibility Statement" or "Accessibility".',
    impact: 'Demonstrates legal compliance with EAA, EU WAD, and Section 508, and provides a clear channel for users to report barriers.',
    reference: 'EAA Directive 2019/882 | EU Web Accessibility Directive 2016/2102 | W3C Accessibility Statement Generator — https://www.w3.org/WAI/planning/statements/',
  },
  {
    id: 'a11y_pdf_links',
    category: 'Accessibility',
    severity: 'warning',
    weight: 5,
    title: 'Links to PDF or Office documents detected',
    check: (d) => (d.html?.links?.pdf_links_count || 0) > 0,
    finding: (d) => `${d.html?.links?.pdf_links_count} link(s) to PDF or Office documents were found. These files must individually meet EN 301 549 Clause 10 accessibility requirements and cannot be assumed to be accessible.`,
    why: 'EN 301 549 v3.2.1 Clause 10 (Non-web Documents) and Section 508 E205 require that all documents downloadable from a website — PDFs, Word files, Excel spreadsheets — meet accessibility standards. PDFs are a common source of accessibility failures: untagged documents, missing reading order, no alt text on images. This is a mandatory manual review item under EAA and Section 508.',
    how_to_fix: 'Audit each linked PDF and Office document for accessibility: add tags, reading order, alt text for images, and meaningful headings. Use Adobe Acrobat Pro, Microsoft Office built-in accessibility checker, or PDF Accessibility Checker (PAC 2024) to identify issues. Where possible, provide an HTML version of the same content as an accessible alternative.',
    impact: 'All downloadable content becomes accessible to screen reader users and compliant with EAA and Section 508.',
    reference: 'EN 301 549 v3.2.1 Clause 10: Non-web Documents — https://www.etsi.org/deliver/etsi_en/301500_301599/301549/03.02.01_60/en_301549v030201p.pdf | Section 508 E205',
  },
  {
    id: 'a11y_captcha_on_auth',
    category: 'Accessibility',
    severity: 'warning',
    weight: 8,
    title: 'CAPTCHA detected on page — verify accessible alternative exists',
    check: (d) => d.html?.captcha_detected === true,
    finding: () => 'A CAPTCHA (reCAPTCHA, hCAPTCHA, or Cloudflare Turnstile) was detected on this page. Verify that an accessible alternative authentication method is available.',
    why: 'CAPTCHAs that require visual or audio puzzle-solving can be inaccessible to users with visual impairments, cognitive disabilities, or those using screen readers. WCAG 2.2 SC 3.3.8 Accessible Authentication (Level AA) — adopted by the EAA from June 2025 — requires that authentication not depend on a cognitive function test unless an alternative is provided. ADA Title III litigation has also targeted inaccessible CAPTCHAs.',
    how_to_fix: 'If using reCAPTCHA v2, ensure the audio challenge is fully functional and accessible. Consider switching to reCAPTCHA v3 (invisible, no user interaction) or Cloudflare Turnstile (no puzzle). Provide a human-contact fallback (email, phone) for users who cannot complete the CAPTCHA. Never rely solely on visual-only challenges.',
    impact: 'Users with visual, cognitive, or motor disabilities can complete authentication and access gated content.',
    reference: 'WCAG 2.2 SC 3.3.8: Accessible Authentication (Minimum) (Level AA) — https://www.w3.org/WAI/WCAG22/Understanding/accessible-authentication-minimum.html',
  },
  {
    id: 'a11y_accessibility_overlay',
    category: 'Accessibility',
    severity: 'warning',
    weight: 10,
    title: 'Accessibility overlay widget detected',
    check: (d) => d.html?.uses_accessibility_overlay === true,
    finding: (d) => `An accessibility overlay widget from ${d.html?.overlay_vendor || 'a known vendor'} was detected. Overlay widgets are widely rejected by the accessibility community and courts as insufficient for legal compliance.`,
    why: 'Accessibility overlay products (accessiBe, UserWay, AudioEye, EqualWeb, etc.) claim to automatically fix accessibility issues via a JavaScript widget. However, the US Department of Justice has stated these tools do not reliably achieve WCAG 2.1 AA compliance, multiple US federal courts have ruled they are insufficient under ADA Title III, and hundreds of accessibility experts signed the Overlay Fact Sheet rejecting them. They can also interfere with screen readers and keyboard navigation.',
    how_to_fix: 'Remove the overlay widget. Invest in proper accessibility remediation: audit with axe DevTools or WAVE, fix underlying HTML/CSS issues, and train developers in accessible coding practices. Engage a qualified accessibility consultant for a formal WCAG 2.1 AA audit.',
    impact: 'Genuine accessibility for all users, reduced legal risk, and correct operation of assistive technologies without widget interference.',
    reference: 'Overlay Fact Sheet — https://overlayfactsheet.com | DOJ ADA Title II 2024 Final Rule — https://www.ada.gov/resources/2024-03-08-web-rule/',
  },
  {
    id: 'a11y_lang_of_parts',
    category: 'Accessibility',
    severity: 'warning',
    weight: 6,
    title: 'Language of parts not marked on multilingual page',
    check: (d) => {
      // Only flag when page has hreflang alternates (signals multilingual) but no child lang attrs
      const hasHreflang = (d.seo?.hreflang?.length || 0) > 1;
      const hasChildLangAttrs = (d.html?.semantic?.child_lang_attrs_count || 0) > 0;
      return hasHreflang && !hasChildLangAttrs;
    },
    finding: () => 'This page has hreflang alternate links (indicating multilingual content) but no child elements use a lang attribute to mark language changes within the page.',
    why: 'When a page contains content in more than one language, each language segment must be wrapped in an element with the appropriate lang attribute. Without this, screen readers use the root html[lang] for all content, causing incorrect pronunciation of foreign-language segments. This violates WCAG 2.1 SC 3.1.2 Language of Parts (Level AA), inherited by ADA, EAA/EN 301 549, Section 508, and AODA.',
    how_to_fix: 'Wrap any text that differs from the primary page language in an element with the correct lang attribute. Example: <span lang="fr">Bonjour le monde</span>. Use valid BCP 47 language codes.',
    impact: 'Screen readers pronounce all language segments correctly, improving comprehension for multilingual content.',
    reference: 'WCAG 2.1 SC 3.1.2: Language of Parts (Level AA) — https://www.w3.org/TR/WCAG21/#language-of-parts',
  },

  // ── Positive ───────────────────────────────────────────────────────────────

  {
    id: 'a11y_lang_set',
    category: 'Accessibility',
    severity: 'positive',
    weight: 0,
    title: 'Language attribute correctly set',
    check: (d) => !!d.html?.semantic?.lang_attr,
    finding: (d) => `The HTML lang attribute is set to "${d.html?.semantic?.lang_attr}", correctly identifying the page language.`,
    why: 'The language attribute enables correct pronunciation by screen readers and is required for WCAG 2.1 Level A compliance.',
    how_to_fix: 'No action required.',
    impact: 'Screen readers can pronounce content correctly in the identified language.',
    reference: 'WCAG 2.1 Success Criterion 3.1.1: Language of Page (Level A)',
  },
  {
    id: 'a11y_all_images_have_alt',
    category: 'Accessibility',
    severity: 'positive',
    weight: 0,
    title: 'All images have alt text',
    check: (d) => {
      const total   = d.html?.images?.total || 0;
      const missing = d.html?.images?.missing_alt || 0;
      return total > 0 && missing === 0;
    },
    finding: (d) => `All ${d.html?.images?.total} images have an alt attribute.`,
    why: 'Images with alt text are accessible to screen reader users and meet WCAG 2.1 Level A requirements.',
    how_to_fix: 'No action required.',
    impact: 'All images are accessible to visually impaired users using assistive technology.',
    reference: 'WCAG 2.1 Success Criterion 1.1.1: Non-text Content (Level A)',
  },
];
