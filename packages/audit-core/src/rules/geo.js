'use strict';
/**
 * GEO — Generative Engine Optimization Rules
 *
 * PRIMARY REFERENCES:
 *   GEO: Generative Engine Optimization (KDD '24, Princeton)
 *   https://arxiv.org/abs/2311.09735
 *
 *   Onely: How to Rank on Perplexity
 *   https://www.onely.com/blog/how-to-rank-on-perplexity/
 *
 *   Search Engine Land: Schema Markup for AI Search
 *   https://searchengineland.com/schema-markup-ai-search-no-hype-472339
 *
 *   Writesonic: AI Crawler Study
 *   https://writesonic.com/blog/ai-crawler-study-what-llms-see-on-your-website
 *
 *   Semrush: llms.txt explained
 *   https://www.semrush.com/blog/llms-txt/
 *
 * CONTEXT:
 *   AI search engines (ChatGPT, Perplexity, Google AI Overviews, Bing Copilot)
 *   now account for a significant and growing share of discovery traffic.
 *   GEO optimises for citation/inclusion in AI-generated answers — distinct
 *   from traditional SEO which targets ranked link positions.
 *
 *   Research shows up to 40% citation boost from targeted optimisations.
 *   Pages with complete Article schema: 47% top-3 citation rate vs 28% without.
 *   Named authors with credentials: 2.3–4× higher citation rates.
 *   Content freshness is the primary Perplexity ranking signal.
 *
 * RULE TIERS:
 *   [CRITICAL] — Prevents AI crawlers from indexing the site, or blocks citation
 *   [WARNING]  — Significant signal missing; notable citation impact
 *   [INFO]     — Best-practice signal; smaller marginal impact
 *   [POSITIVE] — Recognition for correct implementation; weight = 0
 */

// ── Helpers ──────────────────────────────────────────────────────────────────

const ARTICLE_TYPES = ['Article', 'BlogPosting', 'NewsArticle', 'TechArticle', 'ScholarlyArticle'];
const ORG_TYPES     = ['Organization', 'LocalBusiness', 'Corporation', 'NGO', 'EducationalOrganization', 'Brand'];

function hasSchemaType(d, types) {
  const t = d.seo?.json_ld?.types || [];
  return t.some(x => types.includes(x));
}

function getArticleSchema(d) {
  const schemas = d.seo?.json_ld?.schemas || [];
  return schemas.find(s => ARTICLE_TYPES.includes(s.type));
}

function parseDate(str) {
  if (!str) return null;
  try {
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
  } catch { return null; }
}

function daysSince(date) {
  return (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
}

module.exports = [

  // ── STRUCTURED DATA ──────────────────────────────────────────────────────

  {
    id: 'geo_no_schema_markup',
    category: 'AI_Readiness',
    severity: 'critical',
    weight: 20,
    title: 'No JSON-LD structured data found',
    check: (d) => {
      try { return (d.seo?.json_ld?.count || 0) === 0; } catch { return false; }
    },
    finding: () => 'The page has no JSON-LD structured data (<script type="application/ld+json">).',
    why: 'Structured data is the primary mechanism AI search engines use to understand, classify, and cite content. Research shows pages with proper schema markup achieve a 47% top-3 citation rate in AI search results, compared to 28% without it. Google AI Overviews appearances increase 40% with Tier-1 schema.',
    how_to_fix: 'Add at minimum an Organization schema in the <head> of every page, and an Article or BlogPosting schema on content pages. Include author, datePublished, dateModified, headline, and publisher fields. Use Google\'s Rich Results Test to validate.',
    impact: 'Unlocks direct citation eligibility in AI search engines and enables rich result display in traditional search.',
    reference: 'GEO: Generative Engine Optimization (KDD \'24) | Schema.org: https://schema.org/',
  },

  {
    id: 'geo_article_schema_missing',
    category: 'AI_Readiness',
    severity: 'warning',
    weight: 10,
    title: 'No Article schema on content page',
    check: (d) => {
      try { return !hasSchemaType(d, ARTICLE_TYPES); } catch { return false; }
    },
    finding: () => 'No Article, BlogPosting, or NewsArticle schema was found on this page.',
    why: 'Article schema is the most impactful schema type for AI citation. It signals to AI crawlers that the page contains citable content and enables extraction of structured metadata (author, publish date, topic). Pages with Article schema see a 47% top-3 citation rate versus 28% for unstructured pages.',
    how_to_fix: 'Add a JSON-LD Article or BlogPosting schema block with: headline, author (with name and sameAs links), datePublished, dateModified, publisher (with logo), and image. Place it in the <head> section.',
    impact: 'Significant increase in probability of being cited in AI-generated answers.',
    reference: 'Google Search Central: Article | https://developers.google.com/search/docs/appearance/structured-data/article',
  },

  {
    id: 'geo_organization_schema_missing',
    category: 'AI_Readiness',
    severity: 'warning',
    weight: 8,
    title: 'No Organization schema found',
    check: (d) => {
      try { return !hasSchemaType(d, ORG_TYPES); } catch { return false; }
    },
    finding: () => 'No Organization, LocalBusiness, or Brand schema was found on this site.',
    why: 'Organization schema establishes entity identity — it tells AI systems who you are and links your site to verified identities on LinkedIn, Wikipedia, and Crunchbase. Without it, AI models cannot reliably disambiguate your brand from similarly-named entities, reducing citation frequency.',
    how_to_fix: 'Add an Organization schema block to the homepage and/or site-wide template. Include: name, url, logo, description, and sameAs (array of LinkedIn, Twitter/X, Crunchbase, Wikipedia URLs for your organisation).',
    impact: 'Improves entity disambiguation, brand authority signals, and consistency of citations across all AI platforms.',
    reference: 'Schema.org: Organization | https://schema.org/Organization',
  },

  {
    id: 'geo_schema_missing_author',
    category: 'AI_Readiness',
    severity: 'warning',
    weight: 12,
    title: 'Article schema is missing an author',
    check: (d) => {
      try {
        const s = getArticleSchema(d);
        return s !== undefined && !s.has_author;
      } catch { return false; }
    },
    finding: () => 'An Article/BlogPosting schema was found but it does not include an author field.',
    why: 'Named authorship is the highest-impact individual GEO signal. Research shows named authors with verifiable credentials achieve 2.3–4× higher citation rates than anonymous content. AI systems use the author field to assess content credibility and expertise (E-E-A-T signals).',
    how_to_fix: 'Add an author object to your Article schema: { "@type": "Person", "name": "Author Name", "sameAs": ["https://linkedin.com/in/...", "https://twitter.com/..."] }. Link to the author\'s LinkedIn and professional profiles to provide cross-platform verification.',
    impact: 'Up to 4× increase in AI citation rate; builds long-term topical authority.',
    reference: 'GEO Research (KDD \'24) | Google: Author Expertise Signals',
  },

  {
    id: 'geo_schema_missing_date_modified',
    category: 'AI_Readiness',
    severity: 'warning',
    weight: 10,
    title: 'Article schema is missing dateModified',
    check: (d) => {
      try {
        const s = getArticleSchema(d);
        return s !== undefined && !s.has_date_modified;
      } catch { return false; }
    },
    finding: () => 'An Article/BlogPosting schema was found but it does not include a dateModified field.',
    why: 'Content freshness is the primary ranking signal for Perplexity, which accounts for a large share of AI search traffic. The dateModified field in schema is one of the two primary freshness signals AI systems read. Without it, even recently updated content may be treated as stale.',
    how_to_fix: 'Add "dateModified": "YYYY-MM-DDTHH:MM:SSZ" to your Article schema, and update it whenever the content is meaningfully revised. Pair with the Last-Modified HTTP response header for redundancy.',
    impact: 'Perplexity freshness boost: sites with current dateModified achieve up to 38% higher citation rates.',
    reference: 'Onely: How to Rank on Perplexity | https://www.onely.com/blog/how-to-rank-on-perplexity/',
  },

  {
    id: 'geo_has_complete_article_schema',
    category: 'AI_Readiness',
    severity: 'positive',
    weight: 0,
    title: 'Article schema is complete with author and dates',
    check: (d) => {
      try {
        const s = getArticleSchema(d);
        return s !== undefined && s.has_author && s.has_date_modified && s.has_date_published;
      } catch { return false; }
    },
    finding: () => 'Article schema is present with author, datePublished, and dateModified — optimal for AI citation.',
    why: 'Complete Article schema with all required fields is the foundation of strong GEO performance.',
    how_to_fix: 'Continue keeping dateModified current whenever content is updated.',
    impact: 'Maintains 47% top-3 citation rate in AI search engines.',
    reference: 'GEO Research (KDD \'24) | Schema.org: Article',
  },

  {
    id: 'geo_has_faq_schema',
    category: 'AI_Readiness',
    severity: 'positive',
    weight: 0,
    title: 'FAQPage schema is present',
    check: (d) => {
      try { return hasSchemaType(d, ['FAQPage']); } catch { return false; }
    },
    finding: () => 'FAQPage schema is implemented — this is the highest-impact schema type for AI citation.',
    why: 'FAQPage schema achieves a 61.7% AI citation rate, the highest of any schema type, because it directly provides question-answer pairs that AI systems can extract and cite verbatim.',
    how_to_fix: 'Keep FAQ content current and ensure each Question has a clear, concise acceptedAnswer.',
    impact: 'FAQPage schema delivers the highest per-schema ROI for AI search visibility.',
    reference: 'Search Engine Land: Schema for AI Search | https://searchengineland.com/schema-markup-ai-search-no-hype-472339',
  },

  // ── FRESHNESS SIGNALS ────────────────────────────────────────────────────

  {
    id: 'geo_no_last_modified_header',
    category: 'AI_Readiness',
    severity: 'warning',
    weight: 8,
    title: 'Last-Modified HTTP header is missing',
    check: (d) => {
      try { return !d.http?.cache?.last_modified; } catch { return false; }
    },
    finding: () => 'The server does not return a Last-Modified HTTP response header.',
    why: 'The Last-Modified header is one of the two primary freshness signals that Perplexity and other AI search crawlers use. Perplexity\'s indexer shows a visible decay in citation frequency starting 2–3 days after a page is published if freshness signals are absent. Sites with weekly Last-Modified updates achieve ~38% higher citation rates.',
    how_to_fix: 'Configure your web server to return a Last-Modified header reflecting the actual last content modification date. In Apache, this is on by default for static files. For dynamic pages, set it programmatically from your CMS\'s last-modified timestamp.',
    impact: 'Prevents citation decay in Perplexity; strong freshness signal for all AI crawlers.',
    reference: 'HTTP/1.1: Last-Modified (RFC 7232) | Onely: Perplexity ranking signals',
  },

  {
    id: 'geo_content_stale',
    category: 'AI_Readiness',
    severity: 'warning',
    weight: 10,
    title: 'Content has not been updated in over 6 months',
    check: (d) => {
      try {
        // Check Last-Modified header first
        const lm = d.http?.cache?.last_modified;
        if (lm) {
          const date = parseDate(lm);
          if (date && daysSince(date) > 180) return true;
        }
        // Fall back to schema dateModified
        const schemas = d.seo?.json_ld?.schemas || [];
        for (const s of schemas) {
          const dm = parseDate(s.date_modified);
          if (dm && daysSince(dm) > 180) return true;
        }
        return false;
      } catch { return false; }
    },
    finding: (d) => {
      try {
        const lm = d.http?.cache?.last_modified;
        if (lm) {
          const date = parseDate(lm);
          if (date) {
            const days = Math.round(daysSince(date));
            return `Last-Modified header shows content was last updated ${days} days ago.`;
          }
        }
        return 'Content modification date (from schema dateModified) is more than 180 days old.';
      } catch { return 'Content modification date is more than 180 days old.'; }
    },
    why: 'AI search engines, especially Perplexity, aggressively downrank stale content. Content freshness decay is visible within 2–3 days of publication without updates. For evergreen content, even cosmetic updates (adding a new section, updating a statistic) reset the freshness clock and recover citation rank.',
    how_to_fix: 'Review and refresh content older than 3 months. Add new data points, update statistics, expand sections, or improve examples. Update the dateModified schema field and ensure the server returns a current Last-Modified header after each update.',
    impact: 'Recovering content freshness can restore citation rank to near-publication levels.',
    reference: 'Onely: How to Rank on Perplexity | GEO Research (KDD \'24)',
  },

  {
    id: 'geo_no_og_article_dates',
    category: 'AI_Readiness',
    severity: 'info',
    weight: 5,
    title: 'Open Graph article dates are missing',
    check: (d) => {
      try {
        if (!d.seo?.open_graph?.present) return false;
        const data = d.seo?.open_graph?.data || {};
        return !data['article:published_time'] && !data['article:modified_time'];
      } catch { return false; }
    },
    finding: () => 'Open Graph tags are present but og:article:published_time and og:article:modified_time are not set.',
    why: 'Open Graph article timestamps provide a redundant freshness signal alongside the Last-Modified header and schema dateModified. Perplexity reads these tags as a secondary freshness indicator. Their absence weakens the freshness signal stack.',
    how_to_fix: 'Add <meta property="og:article:published_time" content="YYYY-MM-DDTHH:MM:SS+00:00"> and <meta property="og:article:modified_time" content="YYYY-MM-DDTHH:MM:SS+00:00"> to article pages. Most CMS plugins (Yoast, RankMath) handle this automatically if configured.',
    impact: 'Strengthens freshness signal redundancy; marginal citation improvement on Perplexity.',
    reference: 'Open Graph Protocol: Article | https://ogp.me/#type_article',
  },

  // ── AI CRAWLER ACCESS ────────────────────────────────────────────────────

  {
    id: 'geo_ai_crawlers_blocked',
    category: 'AI_Readiness',
    severity: 'critical',
    weight: 20,
    title: 'AI search crawlers are blocked in robots.txt',
    check: (d) => {
      try {
        const content = d.seo?.robots_txt?.content;
        if (!content) return false;
        const AI_BOTS = [
          'gptbot', 'oai-searchbot', 'chatgpt-user',
          'claudebot', 'claude-user', 'claude-searchbot',
          'perplexitybot', 'google-extended',
          'meta-externalagent', 'amazonbot',
        ];
        const lines = content.split('\n').map(l => l.trim().toLowerCase());
        let activeAgents = [];
        for (const line of lines) {
          if (line.startsWith('user-agent:')) {
            activeAgents = [line.replace('user-agent:', '').trim()];
          } else if (line === '') {
            activeAgents = [];
          } else if (line.startsWith('disallow:')) {
            const path = line.replace('disallow:', '').trim();
            if (path === '/' && activeAgents.some(a => AI_BOTS.includes(a))) return true;
          }
        }
        return false;
      } catch { return false; }
    },
    finding: (d) => {
      try {
        const content = d.seo?.robots_txt?.content || '';
        const AI_BOTS = [
          'gptbot', 'oai-searchbot', 'chatgpt-user',
          'claudebot', 'claude-user', 'claude-searchbot',
          'perplexitybot', 'google-extended',
          'meta-externalagent', 'amazonbot',
        ];
        const blocked = [];
        const lines = content.split('\n').map(l => l.trim().toLowerCase());
        let activeAgents = [];
        for (const line of lines) {
          if (line.startsWith('user-agent:')) {
            activeAgents = [line.replace('user-agent:', '').trim()];
          } else if (line === '') {
            activeAgents = [];
          } else if (line.startsWith('disallow:')) {
            const path = line.replace('disallow:', '').trim();
            if (path === '/') {
              activeAgents.forEach(a => { if (AI_BOTS.includes(a)) blocked.push(a); });
            }
          }
        }
        const names = {
          gptbot: 'GPTBot (ChatGPT)',
          claudebot: 'ClaudeBot (Claude)',
          perplexitybot: 'PerplexityBot',
          'google-extended': 'Google-Extended (AI Overviews)',
          'meta-externalagent': 'Meta AI',
        };
        const named = [...new Set(blocked)].map(b => names[b] || b).join(', ');
        return `The following AI crawlers are blocked by robots.txt (Disallow: /): ${named || blocked.join(', ')}.`;
      } catch { return 'AI search crawlers are blocked in robots.txt.'; }
    },
    why: 'Blocking AI crawlers in robots.txt completely prevents the site from being indexed by AI search engines. ChatGPT, Perplexity, Google AI Overviews, and Claude all check robots.txt before crawling. A blocked site will not appear in AI-generated answers regardless of content quality.',
    how_to_fix: 'Review your robots.txt and remove or replace "Disallow: /" rules for AI-specific User-agents. If you want to allow indexing, use "Allow: /" or remove the block entirely. Consider using /llms.txt to specify granular permissions per AI platform.',
    impact: 'Immediate: restores eligibility for AI search citation once crawlers re-index the site.',
    reference: 'OpenAI: GPTBot | Anthropic: ClaudeBot | https://platform.openai.com/docs/gptbot',
  },

  {
    id: 'geo_no_llms_txt',
    category: 'AI_Readiness',
    severity: 'info',
    weight: 5,
    title: 'No /llms.txt file found',
    check: (d) => {
      try { return d.seo?.llms_txt?.exists !== true; } catch { return false; }
    },
    finding: () => 'No /llms.txt file was found at the domain root.',
    why: 'llms.txt is an emerging standard (analogous to robots.txt) that lets site owners provide AI systems with structured, machine-readable information about site content, purpose, and permissions. While not yet enforced by major AI platforms, early adoption signals AI-readiness and provides a clean interface for future AI integrations.',
    how_to_fix: 'Create a /llms.txt file at your domain root following the specification at https://llmstxt.org/. At minimum, include your site name, description, and links to key content sections in Markdown format.',
    impact: 'Positions the site for compatibility with emerging AI content protocols; negligible current ranking impact.',
    reference: 'llms.txt specification | https://llmstxt.org/ | Semrush: https://www.semrush.com/blog/llms-txt/',
  },

  // ── CONTENT STRUCTURE ─────────────────────────────────────────────────────

  {
    id: 'geo_og_missing',
    category: 'AI_Readiness',
    severity: 'warning',
    weight: 10,
    title: 'No Open Graph metadata found',
    check: (d) => {
      try { return !d.seo?.open_graph?.present; } catch { return false; }
    },
    finding: () => 'The page has no Open Graph meta tags (og:title, og:description, og:type, etc.).',
    why: 'Open Graph metadata provides a compact, machine-readable summary of the page that AI crawlers use as a fallback when structured data is absent or incomplete. It also defines content type (og:type: article) and enables richer citation previews across AI platforms and social networks.',
    how_to_fix: 'Add at minimum: og:title, og:description, og:type (article or website), og:url, and og:image. For article pages also add og:article:published_time and og:article:modified_time. WordPress: use Yoast SEO or RankMath. Other stacks: add meta tags to the <head>.',
    impact: 'Improves AI content comprehension and citation snippet quality across all AI platforms.',
    reference: 'Open Graph Protocol | https://ogp.me/',
  },

  {
    id: 'geo_no_structured_content',
    category: 'AI_Readiness',
    severity: 'warning',
    weight: 8,
    title: 'No lists or tables found in page content',
    check: (d) => {
      try { return (d.html?.lists_count || 0) === 0 && (d.html?.tables_count || 0) === 0; } catch { return false; }
    },
    finding: () => 'The page contains no <ul>, <ol>, or <table> elements.',
    why: 'AI search engines heavily favour structured content. Research shows that lists and comparison tables receive 2.5× higher citation rates than prose paragraphs with equivalent information density. AI systems extract and re-present structured content much more reliably than unstructured prose.',
    how_to_fix: 'Structure key information as bullet lists or numbered steps. Convert comparison information into HTML tables. Self-contained sections with H2 headings + a supporting list are the most AI-extractable content format.',
    impact: 'Up to 2.5× higher citation rate for content reformatted from prose to structured lists/tables.',
    reference: 'GEO Research (KDD \'24) | Onely: Perplexity content signals',
  },

  {
    id: 'geo_no_article_element',
    category: 'AI_Readiness',
    severity: 'info',
    weight: 5,
    title: 'No <article> semantic element found',
    check: (d) => {
      try { return !d.html?.semantic?.has_article; } catch { return false; }
    },
    finding: () => 'The page does not use an <article> HTML element to wrap its primary content.',
    why: 'The <article> element is an explicit semantic signal to crawlers that the enclosed content is a self-contained, independently distributable piece of content. AI crawlers use semantic HTML to identify extractable content boundaries, distinguishing main content from navigation, sidebars, and footers.',
    how_to_fix: 'Wrap the main content of article, blog, and documentation pages in an <article> element. Ensure the primary heading (H1) and body text are within <article>. This works alongside and does not replace JSON-LD Article schema.',
    impact: 'Improves AI content boundary detection; modest citation accuracy improvement.',
    reference: 'HTML Living Standard: article element | https://html.spec.whatwg.org/multipage/sections.html#the-article-element',
  },

  {
    id: 'geo_no_external_citations',
    category: 'AI_Readiness',
    severity: 'warning',
    weight: 8,
    title: 'No outbound links — content lacks external citations',
    check: (d) => {
      try { return (d.html?.links?.external_count || 0) === 0; } catch { return false; }
    },
    finding: () => 'The page has no outbound links to external sources.',
    why: 'AI search engines use outbound citation density as a trust and authority signal. Linking to authoritative sources (.gov, .edu, peer-reviewed research, industry authorities) signals that claims are backed by evidence. Content without external citations is treated as less authoritative and gets cited less frequently in AI answers.',
    how_to_fix: 'For content pages, link to authoritative sources that support key claims (aim for 3–5 external citations per major content section). Prioritise .gov, .edu, and well-known industry sources. Use descriptive anchor text that identifies the source.',
    impact: 'Increases perceived authority of content; improves citation eligibility in AI answer quality filters.',
    reference: 'GEO Research (KDD \'24): Citation density as trust signal',
  },

  // ── AUTHOR SIGNALS ────────────────────────────────────────────────────────

  {
    id: 'geo_no_author_signal',
    category: 'AI_Readiness',
    severity: 'warning',
    weight: 12,
    title: 'No author signal found on this page',
    check: (d) => {
      try {
        // Check schema author
        const schemas = d.seo?.json_ld?.schemas || [];
        if (schemas.some(s => s.has_author)) return false;
        // Check meta[name="author"]
        if (d.html?.author_meta) return false;
        return true;
      } catch { return false; }
    },
    finding: () => 'No author was detected via JSON-LD schema author field or <meta name="author"> tag.',
    why: 'Named authorship is the single highest-impact GEO signal for content pages. Research published at KDD \'24 shows named authors with verifiable credentials achieve 2.3–4× higher citation rates than anonymous content. AI systems assess E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness) and author credibility is the primary E-E-A-T input.',
    how_to_fix: 'Add author information via two channels: (1) In Article JSON-LD schema: "author": { "@type": "Person", "name": "Full Name", "sameAs": ["https://linkedin.com/in/..."] }. (2) As a visible byline on the page and in <meta name="author" content="Full Name">. Link the author to their professional profiles for cross-platform verification.',
    impact: 'Up to 4× increase in AI citation rate; strongest individual content signal for GEO.',
    reference: 'GEO Research (KDD \'24): Author credibility signal | Google: E-E-A-T guidelines',
  },

];
