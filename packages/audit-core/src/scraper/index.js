/**
 * scraper.js
 *
 * Collects all raw audit data from a live URL.
 * Zero AI — pure Node.js + cheerio HTML parsing.
 *
 * Returns a structured JSON object covering:
 *   - HTTP layer      (headers, SSL hint, redirects, cookies, cache)
 *   - HTML structure  (headings, images, links, forms, semantic tags)
 *   - SEO             (title, description, canonical, robots.txt, sitemap, OG, JSON-LD)
 *   - Performance     (page weight, render-blocking, image formats, lazy loading)
 *   - Security        (security headers, mixed content, exposed files, clickjacking)
 *   - Platform        (WordPress, WooCommerce, React, Vue, Angular, page builders)
 *
 * This object is passed directly to claude-interpreter.js which turns it
 * into scored, plain-language findings.
 */

const https              = require('https');
const http               = require('http');
const { URL }            = require('url');
const { lookup: dnsLookup } = require('dns').promises;
const cheerio = require('cheerio');

// ─── CONFIG ──────────────────────────────────────────────────────────────────

const FETCH_TIMEOUT_MS   = 15000;
const MAX_BODY_BYTES     = 300_000;  // 300 KB — enough for thorough analysis
const LINK_CHECK_LIMIT   = 30;       // max internal links to HEAD-probe for broken status
const INTERNAL_LINKS_MAX = 100;      // max internal links stored for crawl discovery
const EXPOSED_PATHS      = [
  '/.env', '/.git/config', '/wp-config.php', '/phpinfo.php',
  '/config.php', '/.htpasswd', '/backup.sql', '/dump.sql',
  '/database.sql', '/db.sql', '/.DS_Store',
];
const SENSITIVE_FILE_PATHS = [
  '/wp-login.php', '/wp-admin/', '/wp-json/wp/v2/users',
  '/xmlrpc.php', '/.well-known/security.txt',
];

// ─── SSRF PROTECTION ─────────────────────────────────────────────────────────

/**
 * Returns true if the given IP address (v4 or v6) is private/reserved.
 * Used to block SSRF after DNS resolution.
 */
function isPrivateIp(addr) {
  if (!addr) return true;
  // IPv6 loopback / link-local
  if (addr === '::1' || addr.toLowerCase().startsWith('fe80:')) return true;
  // IPv4-mapped IPv6: ::ffff:192.168.1.1
  const v4mapped = addr.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  const ip = v4mapped ? v4mapped[1] : addr;
  const parts = ip.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!parts) return false; // non-private IPv6 — allow
  const [a, b] = [+parts[1], +parts[2]];
  if (a === 127)                        return true; // loopback
  if (a === 0)                          return true; // 0.0.0.0
  if (a === 10)                         return true; // RFC 1918
  if (a === 172 && b >= 16 && b <= 31)  return true; // RFC 1918
  if (a === 192 && b === 168)           return true; // RFC 1918
  if (a === 169 && b === 254)           return true; // link-local
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT RFC 6598
  return false;
}

// ─── LOW-LEVEL HTTP ───────────────────────────────────────────────────────────

/**
 * Fetch a URL. Returns headers + body + metadata.
 * Follows up to 5 redirects. Caps body at MAX_BODY_BYTES.
 *
 * SSRF protection:
 *  - Resolves hostname via DNS before connecting.
 *  - Pins the connection to the resolved IP (prevents DNS rebinding).
 *  - Re-validates every redirect destination through the same checks.
 */
async function fetchUrl(url, method = 'GET', redirectCount = 0) {
  if (redirectCount > 5) {
    return { ok: false, error: 'Too many redirects', redirects: redirectCount };
  }

  let parsed;
  try { parsed = new URL(url); }
  catch { return { ok: false, error: 'Invalid URL' }; }

  // ── SSRF: resolve hostname → validate → pin connection to IP ─────────────
  const rawHost = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase();

  // Fast literal checks (no DNS needed)
  if (rawHost === 'localhost' || rawHost === '::1') {
    return { ok: false, error: 'Blocked: private address' };
  }

  let resolvedIp;
  const isIpLiteral = /^(\d+\.){3}\d+$/.test(rawHost) || rawHost.includes(':');
  if (isIpLiteral) {
    resolvedIp = rawHost;
  } else {
    try {
      const resolved = await dnsLookup(parsed.hostname, { family: 4 });
      resolvedIp = resolved.address;
    } catch {
      return { ok: false, error: 'DNS resolution failed' };
    }
  }

  if (isPrivateIp(resolvedIp)) {
    return { ok: false, error: 'Blocked: resolves to private/reserved address' };
  }

  const startTime = Date.now();
  const lib = parsed.protocol === 'https:' ? https : http;
  const options = {
    hostname: resolvedIp,               // connect to pinned IP (prevents rebinding)
    port:     parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
    path:     parsed.pathname + parsed.search,
    method,
    timeout:  FETCH_TIMEOUT_MS,
    headers: {
      'User-Agent':      'Mozilla/5.0 (compatible; SiteAuditor/2.0)',
      'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'identity',
      'Host':            parsed.host,   // correct Host header for virtual hosting
    },
  };

  // SNI — must use the original hostname, not the IP
  if (parsed.protocol === 'https:') {
    options.servername = parsed.hostname;
  }

  return new Promise((resolve) => {
    const req = lib.request(options, (res) => {
      const responseTimeMs = Date.now() - startTime;

      // Follow redirects — fetchUrl is now async so recursion re-runs all SSRF checks
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        let loc = res.headers.location;
        if (loc.startsWith('/')) loc = `${parsed.protocol}//${parsed.hostname}${loc}`;
        res.resume();
        fetchUrl(loc, method, redirectCount + 1).then(result => {
          resolve({ ...result, redirected_from: url, redirects: (result.redirects || 0) + 1 });
        });
        return;
      }

      const chunks = [];
      let bytesRead = 0;
      let truncated = false;

      res.on('data', (chunk) => {
        if (bytesRead < MAX_BODY_BYTES) {
          const remaining = MAX_BODY_BYTES - bytesRead;
          chunks.push(chunk.slice(0, remaining));
          bytesRead += chunk.length;
        } else {
          truncated = true;
        }
      });

      res.on('end', () => {
        resolve({
          ok:             res.statusCode >= 200 && res.statusCode < 400,
          statusCode:     res.statusCode,
          headers:        res.headers,
          body:           Buffer.concat(chunks).toString('utf8'),
          bodyBytes:      bytesRead,
          truncated,
          responseTimeMs,
          finalUrl:       url,
          redirects:      redirectCount,
        });
      });

      res.on('error', (e) => resolve({ ok: false, error: e.message }));
    });

    req.on('timeout', () => { req.destroy(); resolve({ ok: false, error: 'Timeout' }); });
    req.on('error', (e) => resolve({ ok: false, error: e.message }));
    req.end();
  });
}

/**
 * Quick HEAD probe — status code + headers only, no body.
 */
function probeUrl(url) {
  return fetchUrl(url, 'HEAD');
}

/**
 * POST request with a JSON body — used for GraphQL introspection probes.
 * Returns { ok, statusCode, headers, body }.
 */
function postJson(url, body) {
  return new Promise((resolve) => {
    let parsed;
    try { parsed = new URL(url); }
    catch { resolve({ ok: false, error: 'Invalid URL' }); return; }

    const payload = JSON.stringify(body);
    const lib = parsed.protocol === 'https:' ? https : http;
    const options = {
      hostname: parsed.hostname,
      port:     parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path:     parsed.pathname + parsed.search,
      method:   'POST',
      timeout:  FETCH_TIMEOUT_MS,
      headers: {
        'User-Agent':    'Mozilla/5.0 (compatible; SiteAuditor/2.0)',
        'Content-Type':  'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'Accept':         'application/json',
        'Accept-Encoding': 'identity',
      },
    };

    const req = lib.request(options, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8').slice(0, 20000);
        resolve({ ok: res.statusCode < 400, statusCode: res.statusCode, headers: res.headers, body });
      });
    });
    req.on('error', () => resolve({ ok: false, error: 'Request failed' }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, error: 'Timeout' }); });
    req.write(payload);
    req.end();
  });
}

/**
 * OPTIONS request with a custom Origin — used for CORS reflection detection.
 */
function probeOptions(url, origin) {
  return new Promise((resolve) => {
    let parsed;
    try { parsed = new URL(url); }
    catch { resolve({ ok: false }); return; }

    const lib = parsed.protocol === 'https:' ? https : http;
    const options = {
      hostname: parsed.hostname,
      port:     parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path:     parsed.pathname + parsed.search,
      method:   'OPTIONS',
      timeout:  8000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SiteAuditor/2.0)',
        'Origin':     origin,
        'Access-Control-Request-Method': 'GET',
      },
    };

    const req = lib.request(options, (res) => {
      res.resume();
      resolve({ ok: true, statusCode: res.statusCode, headers: res.headers });
    });
    req.on('error', () => resolve({ ok: false }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false }); });
    req.end();
  });
}

// ─── HTTP LAYER ───────────────────────────────────────────────────────────────

function analyseHttpLayer(page, originalUrl) {
  const h = page.headers || {};
  const get = (k) => (h[k.toLowerCase()] || '');

  // Cookie analysis
  const rawCookies = [].concat(h['set-cookie'] || []);
  const cookies = rawCookies.map(c => {
    const lower = c.toLowerCase();
    return {
      raw:       c.split(';')[0].trim(),
      secure:    lower.includes('secure'),
      httponly:  lower.includes('httponly'),
      samesite:  lower.includes('samesite=strict') ? 'strict'
               : lower.includes('samesite=lax')    ? 'lax'
               : lower.includes('samesite=none')   ? 'none'
               : null,
    };
  });

  // Cache analysis
  const cacheControl = get('cache-control');
  const hasMaxAge   = /max-age=\d+/.test(cacheControl);
  const isNoStore   = cacheControl.includes('no-store');
  const isNoCache   = cacheControl.includes('no-cache');

  return {
    status_code:    page.statusCode,
    response_time_ms: page.responseTimeMs,
    final_url:      page.finalUrl,
    redirects:      page.redirects || 0,
    https:          page.finalUrl?.startsWith('https://') ?? originalUrl.startsWith('https://'),
    original_http:  originalUrl.startsWith('http://') && !originalUrl.startsWith('https://'),
    server:         get('server') || null,
    powered_by:     get('x-powered-by') || null,
    content_type:   get('content-type'),
    content_length: parseInt(get('content-length')) || page.bodyBytes || null,

    security_headers: {
      csp:                get('content-security-policy') || null,
      hsts:               get('strict-transport-security') || null,
      x_frame_options:    get('x-frame-options') || null,
      referrer_policy:    get('referrer-policy') || null,
      permissions_policy: get('permissions-policy') || null,
      x_content_type:     get('x-content-type-options') || null,
    },

    cache: {
      cache_control:  cacheControl || null,
      etag:           !!h['etag'],
      last_modified:  get('last-modified') || null,
      has_max_age:    hasMaxAge,
      is_no_store:    isNoStore,
      is_no_cache:    isNoCache,
      cdn_detected:   get('server').toLowerCase().includes('cloudflare') ||
                      !!h['cf-ray'] || !!h['x-served-by'] ||
                      get('x-cache').toLowerCase().includes('hit'),
    },

    cookies,
    cookies_count:  cookies.length,
    cookies_without_secure:   cookies.filter(c => !c.secure).length,
    cookies_without_httponly: cookies.filter(c => !c.httponly).length,
    cookies_without_samesite: cookies.filter(c => !c.samesite).length,

    // Version / technology disclosure via headers
    server_version_exposed: (() => {
      const s = get('server');
      return s ? /[\d]+\.[\d]+/.test(s) : false;
    })(),
    php_version_exposed: (() => {
      const p = get('x-powered-by');
      return p ? p.toLowerCase().includes('php/') : false;
    })(),

    // WordPress pingback header (DDoS reflection vector)
    pingback_header: get('x-pingback') || null,
  };
}

// ─── HTML STRUCTURE ───────────────────────────────────────────────────────────

function analyseHtmlStructure($, baseUrl) {
  const parsed = (() => { try { return new URL(baseUrl); } catch { return null; } })();
  const baseHost = parsed?.hostname || '';

  // ── Headings ──
  const headings = { h1: [], h2: [], h3: [], h4: [], h5: [], h6: [] };
  ['h1','h2','h3','h4','h5','h6'].forEach(tag => {
    $(`${tag}`).each((_, el) => {
      const text = $(el).text().trim().replace(/\s+/g, ' ');
      if (text) headings[tag].push(text);
    });
  });

  const headingIssues = [];
  if (headings.h1.length === 0)  headingIssues.push('No H1 tag found');
  if (headings.h1.length > 1)    headingIssues.push(`Multiple H1 tags (${headings.h1.length})`);
  if (headings.h2.length === 0 && headings.h1.length > 0) headingIssues.push('No H2 tags — flat heading structure');

  // ── Images ──
  const images = [];
  $('img').each((_, el) => {
    const src = $(el).attr('src') || '';
    const alt = $(el).attr('alt');
    const loading = $(el).attr('loading');
    const ext = (src.split('?')[0].split('.').pop() || '').toLowerCase();
    images.push({
      src,
      has_alt:      alt !== undefined,
      alt_empty:    alt === '',
      alt_text:     alt || null,
      lazy:         loading === 'lazy',
      format:       ['webp','avif','jpg','jpeg','png','gif','svg','bmp'].includes(ext) ? ext : 'unknown',
    });
  });

  const imageFormats = images.reduce((acc, img) => {
    acc[img.format] = (acc[img.format] || 0) + 1;
    return acc;
  }, {});

  // ── Links ──
  const internalLinks = [];
  const externalLinks = [];
  let emptyTextLinks = 0;
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const text = $(el).text().trim();
    const ariaLabel = $(el).attr('aria-label') || $(el).attr('title') || '';
    const hasAccessibleName = text.length > 0 || ariaLabel.length > 0;
    if (!hasAccessibleName) emptyTextLinks++;
    if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
    try {
      const abs = href.startsWith('http') ? new URL(href) : new URL(href, baseUrl);
      if (abs.hostname === baseHost) {
        internalLinks.push(abs.href);
      } else {
        externalLinks.push(abs.href);
      }
    } catch { /* malformed href */ }
  });

  // ── Media elements ──
  let videoWithoutCaptions = 0;
  $('video').each((_, el) => {
    const hasCaptionTrack = $(el).find('track[kind="captions"], track[kind="subtitles"]').length > 0;
    if (!hasCaptionTrack) videoWithoutCaptions++;
  });

  let audioAutoplayNoControls = 0;
  $('audio[autoplay]').each((_, el) => {
    if (!$(el).attr('controls')) audioAutoplayNoControls++;
  });

  // Check for skip navigation link (first <a> that points to an anchor)
  const firstAnchorLink = $('a[href^="#"]').first();
  const hasSkipLink = firstAnchorLink.length > 0 &&
    ($('a[href^="#"]').index(firstAnchorLink) <= 2 ||
     (firstAnchorLink.attr('href') || '').match(/skip|main|content/i) !== null);

  // iframes without title attribute
  let iframesWithoutTitle = 0;
  $('iframe').each((_, el) => {
    if (!$(el).attr('title')) iframesWithoutTitle++;
  });

  // Duplicate ID detection
  const allIds = [];
  $('[id]').each((_, el) => { allIds.push($(el).attr('id')); });
  const idCounts = allIds.reduce((acc, id) => { acc[id] = (acc[id] || 0) + 1; return acc; }, {});
  const duplicateIds = Object.values(idCounts).filter(count => count > 1).length;

  // ── Forms ──
  const forms = [];
  $('form').each((_, formEl) => {
    const inputs = [];
    $(formEl).find('input, textarea, select').each((_, inputEl) => {
      const id       = $(inputEl).attr('id');
      const name     = $(inputEl).attr('name');
      const type     = $(inputEl).attr('type') || 'text';
      const ariaLabel = $(inputEl).attr('aria-label');
      const hasLabel = id ? $(`label[for="${id}"]`).length > 0 : false;
      inputs.push({ type, name, has_label: hasLabel || !!ariaLabel });
    });
    forms.push({
      action:   $(formEl).attr('action') || null,
      method:   $(formEl).attr('method') || 'get',
      inputs,
      inputs_without_label: inputs.filter(i => !i.has_label && i.type !== 'hidden' && i.type !== 'submit').length,
    });
  });

  // ── Semantic structure ──
  const semantic = {
    has_main:    $('main').length > 0,
    has_nav:     $('nav').length > 0,
    has_header:  $('header').length > 0,
    has_footer:  $('footer').length > 0,
    has_article: $('article').length > 0,
    has_aside:   $('aside').length > 0,
    lang_attr:   $('html').attr('lang') || null,
  };

  // ── ARIA ──
  const ariaIssues = [];
  $('[role]').each((_, el) => {
    const role = $(el).attr('role');
    const hasLabel = $(el).attr('aria-label') || $(el).attr('aria-labelledby') || $(el).text().trim();
    if ((role === 'button' || role === 'link') && !hasLabel) {
      ariaIssues.push(`Element with role="${role}" has no accessible label`);
    }
    if (role === 'checkbox' && !$(el).attr('aria-checked')) {
      ariaIssues.push('Element with role="checkbox" missing aria-checked state');
    }
    if (role === 'combobox' && !$(el).attr('aria-expanded')) {
      ariaIssues.push('Element with role="combobox" missing aria-expanded state');
    }
    if (role === 'img' && !$(el).attr('aria-label') && !$(el).attr('aria-labelledby')) {
      ariaIssues.push('Element with role="img" has no accessible label');
    }
  });
  $('button').each((_, el) => {
    if (!$(el).text().trim() && !$(el).attr('aria-label') && !$(el).attr('title') && !$(el).attr('aria-labelledby')) {
      ariaIssues.push('Empty <button> with no accessible label');
    }
  });
  // Check for positive tabindex (disrupts natural tab order, WCAG 2.4.3)
  const positiveTabindex = $('[tabindex]').filter((_, el) => {
    const val = parseInt($(el).attr('tabindex'), 10);
    return val > 0;
  }).length;
  if (positiveTabindex > 0) {
    ariaIssues.push(`${positiveTabindex} element(s) have positive tabindex values, disrupting natural tab order`);
  }
  // Check for broken ARIA references
  $('[aria-labelledby], [aria-describedby], [aria-controls]').each((_, el) => {
    ['aria-labelledby', 'aria-describedby', 'aria-controls'].forEach(attr => {
      const val = $(el).attr(attr);
      if (val && !$(`#${val.split(' ')[0]}`).length) {
        ariaIssues.push(`${attr}="${val}" references a non-existent ID`);
      }
    });
  });

  // Lists and tables — AI crawlers prefer structured content
  const listsCount  = $('ul, ol').length;
  const tablesCount = $('table').length;

  // Author meta tag
  const authorMeta = $('meta[name="author"]').attr('content') || null;

  return {
    headings,
    heading_issues: headingIssues,
    images: {
      total:              images.length,
      missing_alt:        images.filter(i => !i.has_alt).length,
      empty_alt:          images.filter(i => i.alt_empty).length,
      with_lazy_loading:  images.filter(i => i.lazy).length,
      without_lazy_loading: images.filter(i => !i.lazy).length,
      formats:            imageFormats,
      modern_formats:     (imageFormats.webp || 0) + (imageFormats.avif || 0),
      legacy_formats:     (imageFormats.jpg || 0) + (imageFormats.jpeg || 0) + (imageFormats.png || 0) + (imageFormats.gif || 0),
      images_list:        images.slice(0, 20),  // first 20 for reference
    },
    links: {
      internal_count:   internalLinks.length,
      external_count:   externalLinks.length,
      internal_sample:  [...new Set(internalLinks)].slice(0, INTERNAL_LINKS_MAX),
      external_sample:  [...new Set(externalLinks)].slice(0, 10),
      empty_text_count: emptyTextLinks,
    },
    forms: {
      count:       forms.length,
      forms_list:  forms,
      total_inputs_without_label: forms.reduce((s, f) => s + f.inputs_without_label, 0),
    },
    semantic: {
      ...semantic,
      has_skip_link: hasSkipLink,
    },
    aria_issues:              ariaIssues,
    iframes_without_title:    iframesWithoutTitle,
    duplicate_ids_count:      duplicateIds,
    video_without_captions:   videoWithoutCaptions,
    audio_autoplay_no_controls: audioAutoplayNoControls,
    lists_count:              listsCount,
    tables_count:             tablesCount,
    author_meta:              authorMeta,
  };
}

// ─── SEO LAYER ────────────────────────────────────────────────────────────────

async function analyseSeo($, page, baseUrl) {
  const parsed = (() => { try { return new URL(baseUrl); } catch { return null; } })();
  const origin = parsed ? `${parsed.protocol}//${parsed.hostname}` : baseUrl;

  // Title
  const titleText   = $('title').first().text().trim();
  const titleLength = titleText.length;

  // Meta description
  const metaDesc   = $('meta[name="description"]').attr('content') || null;
  const metaLength = metaDesc ? metaDesc.length : 0;

  // Canonical
  const canonical = $('link[rel="canonical"]').attr('href') || null;

  // Open Graph
  const og = {};
  $('meta[property^="og:"]').each((_, el) => {
    const prop = $(el).attr('property').replace('og:', '');
    og[prop] = $(el).attr('content');
  });

  // Twitter Card
  const twitter = {};
  $('meta[name^="twitter:"]').each((_, el) => {
    const name = $(el).attr('name').replace('twitter:', '');
    twitter[name] = $(el).attr('content');
  });

  // JSON-LD structured data — types + rich field analysis for GEO
  const jsonLd        = [];
  const jsonLdSchemas = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).html());
      const type = data['@type'] || 'Unknown';
      jsonLd.push(type);
      jsonLdSchemas.push({
        type,
        has_author:          !!(data.author || data.creator),
        has_date_published:  !!data.datePublished,
        has_date_modified:   !!data.dateModified,
        date_modified:       data.dateModified  || null,
        date_published:      data.datePublished || null,
        has_publisher:       !!data.publisher,
        has_image:           !!data.image,
      });
    } catch {
      jsonLd.push('Parse error');
    }
  });

  // Hreflang
  const hreflang = [];
  $('link[rel="alternate"][hreflang]').each((_, el) => {
    hreflang.push({ lang: $(el).attr('hreflang'), href: $(el).attr('href') });
  });

  // robots.txt
  let robotsTxt = { exists: false, content: null, blocking_important: false };
  try {
    const r = await fetchUrl(`${origin}/robots.txt`);
    if (r.ok && r.body && !r.body.toLowerCase().includes('<!doctype')) {
      const content = r.body.substring(0, 3000);
      // Only flag "Disallow: /" (block everything) — not normal path-specific rules
      const blocksSelf = /^disallow:\s*\/\s*$/im.test(content);

      // AI crawler blocking analysis
      const AI_CRAWLER_AGENTS = [
        'gptbot', 'oai-searchbot', 'chatgpt-user',
        'claudebot', 'claude-user', 'claude-searchbot',
        'perplexitybot', 'google-extended',
        'meta-externalagent', 'amazonbot',
      ];
      const blockedAiCrawlers = [];
      const rbLines = content.split('\n').map(l => l.trim().toLowerCase());
      let activeAgents = [];
      for (const line of rbLines) {
        if (line.startsWith('user-agent:')) {
          activeAgents = [line.replace('user-agent:', '').trim()];
        } else if (line === '') {
          activeAgents = [];
        } else if (line.startsWith('disallow:')) {
          const path = line.replace('disallow:', '').trim();
          if (path === '/' && activeAgents.length > 0) {
            activeAgents.forEach(a => {
              if (AI_CRAWLER_AGENTS.includes(a)) blockedAiCrawlers.push(a);
            });
          }
        }
      }

      robotsTxt = {
        exists:              true,
        content:             content,
        blocking_important:  blocksSelf,
        has_sitemap_ref:     content.toLowerCase().includes('sitemap:'),
        blocks_ai_crawlers:  blockedAiCrawlers.length > 0,
        blocked_ai_crawlers: blockedAiCrawlers,
      };
    }
  } catch { /* not critical */ }

  // sitemap.xml
  let sitemap = { exists: false, linked_from_robots: false, valid: false };
  try {
    const sitemapUrl = robotsTxt.content
      ? (robotsTxt.content.match(/sitemap:\s*(https?:\/\/[^\s]+)/i) || [])[1]
      : null;
    const sitemapTarget = sitemapUrl || `${origin}/sitemap.xml`;
    const s = await fetchUrl(sitemapTarget);
    if (s.ok && s.body && (s.body.includes('<urlset') || s.body.includes('<sitemapindex'))) {
      sitemap = {
        exists:              true,
        url:                 sitemapTarget,
        linked_from_robots:  !!sitemapUrl,
        valid:               true,
        url_count:           (s.body.match(/<url>/g) || []).length,
      };
    }
  } catch { /* not critical */ }

  // /llms.txt — emerging AI-friendly content declaration standard
  let llmsTxt = { exists: false };
  try {
    const l = await probeUrl(`${origin}/llms.txt`);
    llmsTxt = { exists: l.statusCode === 200 };
  } catch { /* not critical */ }

  return {
    title: {
      text:       titleText || null,
      length:     titleLength,
      missing:    !titleText,
      too_short:  titleLength > 0 && titleLength < 30,
      too_long:   titleLength > 60,
    },
    meta_description: {
      text:       metaDesc,
      length:     metaLength,
      missing:    !metaDesc,
      too_short:  metaLength > 0 && metaLength < 70,
      too_long:   metaLength > 160,
    },
    canonical: {
      href:          canonical,
      missing:       !canonical,
      self_canonical: canonical ? canonical.includes(parsed?.hostname || '') : false,
    },
    open_graph: {
      present:    Object.keys(og).length > 0,
      has_title:  !!og.title,
      has_desc:   !!og.description,
      has_image:  !!og.image,
      data:       og,
    },
    twitter_card: {
      present: Object.keys(twitter).length > 0,
      data:    twitter,
    },
    json_ld:     { types: jsonLd, schemas: jsonLdSchemas, count: jsonLd.length },
    llms_txt:    llmsTxt,
    hreflang:    { tags: hreflang, count: hreflang.length },
    robots_txt:  robotsTxt,
    sitemap,
  };
}

// ─── PERFORMANCE ──────────────────────────────────────────────────────────────

function analysePerformance($, page) {
  const renderBlockingScripts = [];
  const renderBlockingStyles  = [];
  const deferredScripts       = [];

  $('head script[src]').each((_, el) => {
    const src   = $(el).attr('src') || '';
    const defer = $(el).attr('defer') !== undefined;
    const async_ = $(el).attr('async') !== undefined;
    if (!defer && !async_) {
      renderBlockingScripts.push(src);
    } else {
      deferredScripts.push(src);
    }
  });

  $('head link[rel="stylesheet"]').each((_, el) => {
    const href  = $(el).attr('href') || '';
    const media = $(el).attr('media') || 'all';
    if (media === 'all' || media === 'screen' || media === '') {
      renderBlockingStyles.push(href);
    }
  });

  // Count all resources
  const scripts    = $('script[src]').length;
  const styles     = $('link[rel="stylesheet"]').length;
  const images     = $('img').length;
  const iframes    = $('iframe').length;

  // Inline styles (a hint of inline-heavy design)
  const inlineStyles = $('[style]').length;

  // External fonts (Google Fonts etc.)
  const externalFonts = [];
  $('link[href*="fonts.googleapis.com"], link[href*="fonts.gstatic.com"], link[href*="typekit"]').each((_, el) => {
    externalFonts.push($(el).attr('href'));
  });

  // Preload hints
  const preloads = $('link[rel="preload"]').length;
  const prefetch = $('link[rel="prefetch"]').length;

  return {
    page_size_bytes:    page.bodyBytes || 0,
    page_size_kb:       Math.round((page.bodyBytes || 0) / 1024),
    resource_counts: { scripts, styles, images, iframes },
    render_blocking: {
      scripts:          renderBlockingScripts,
      scripts_count:    renderBlockingScripts.length,
      styles:           renderBlockingStyles,
      styles_count:     renderBlockingStyles.length,
      deferred_scripts: deferredScripts.length,
    },
    external_fonts:      externalFonts,
    external_fonts_count: externalFonts.length,
    preload_hints:       preloads,
    prefetch_hints:      prefetch,
    inline_styles_count: inlineStyles,
    total_resource_count: scripts + styles + images + iframes,
  };
}

// ─── SECURITY ────────────────────────────────────────────────────────────────

async function analyseSecurity($, page, baseUrl) {
  const parsed  = (() => { try { return new URL(baseUrl); } catch { return null; } })();
  const origin  = parsed ? `${parsed.protocol}//${parsed.hostname}` : baseUrl;
  const isHttps = baseUrl.startsWith('https://');

  // Mixed content — HTTP resources on an HTTPS page
  const mixedContent = [];
  if (isHttps) {
    $('img[src^="http:"], script[src^="http:"], link[href^="http:"], iframe[src^="http:"]').each((_, el) => {
      const src = $(el).attr('src') || $(el).attr('href');
      mixedContent.push({ tag: el.name, src });
    });
  }

  // Probe for exposed sensitive files
  const exposedFiles = {};
  const probeResults = await Promise.all(
    EXPOSED_PATHS.map(async (p) => {
      const result = await probeUrl(`${origin}${p}`);
      return { path: p, exposed: result.ok && result.statusCode === 200 };
    })
  );
  probeResults.forEach(({ path, exposed }) => {
    if (exposed) exposedFiles[path] = true;
  });

  // Probe WordPress-specific sensitive endpoints
  const wpProbes = {};
  if (origin.includes('wordpress') || $('body').html()?.includes('wp-content')) {
    const wpEndpoints = [
      { key: 'xmlrpc',           path: '/xmlrpc.php',              check: (r) => r.ok || r.statusCode === 401 },
      { key: 'user_enum',        path: '/wp-json/wp/v2/users',     check: (r) => r.statusCode === 200 },
      { key: 'wp_admin',         path: '/wp-admin/',               check: (r) => r.ok },
      { key: 'readme_exposed',   path: '/readme.html',             check: (r) => r.statusCode === 200 },
      { key: 'license_exposed',  path: '/license.txt',             check: (r) => r.statusCode === 200 },
      { key: 'debug_log_exposed', path: '/wp-content/debug.log',   check: (r) => r.statusCode === 200 },
      { key: 'wp_cron',           path: '/wp-cron.php',             check: (r) => r.statusCode === 200 },
    ];
    const wpResults = await Promise.all(
      wpEndpoints.map(async ({ key, path, check }) => {
        const r = await probeUrl(`${origin}${path}`);
        return { key, exposed: check(r) };
      })
    );
    wpResults.forEach(({ key, exposed }) => { wpProbes[key] = exposed; });

    // Probe for wp-config backup files — any 200 response flags it
    const configBackupPaths = [
      '/wp-config.php.bak',
      '/wp-config.php.old',
      '/wp-config.php.orig',
      '/wp-config.php.save',
      '/wp-config.php~',
      '/wp-config.bak',
    ];
    const backupResults = await Promise.all(
      configBackupPaths.map((p) => probeUrl(`${origin}${p}`))
    );
    wpProbes.config_backup_exposed = backupResults.some((r) => r.statusCode === 200);

    // Probe for directory listing on /wp-content/uploads/ — needs GET for body
    const uploadsResult = await fetchUrl(`${origin}/wp-content/uploads/`, 'GET');
    wpProbes.directory_listing_uploads = uploadsResult.statusCode === 200 &&
      (uploadsResult.body || '').toLowerCase().includes('index of');

    // Probe for author enumeration via /?author=1 — follow redirect and check finalUrl
    const authorResult = await fetchUrl(`${origin}/?author=1`, 'GET');
    wpProbes.author_enum_url = (authorResult.finalUrl || '').toLowerCase().includes('/author/');
  }

  // Probe WooCommerce Store API for unauthenticated access (CVE-2023-7320, CVE-2025-15033)
  const wcProbes = {};
  if ($('body').html()?.includes('woocommerce') || $('body').html()?.includes('wc-block')) {
    const storeApi = await probeUrl(`${origin}/wp-json/wc/store/v1/products`);
    wcProbes.store_api_public = storeApi.ok && storeApi.statusCode === 200;
  }

  // Payment/API key exposure in HTML source (Stripe, PayPal, etc.)
  const bodyText = page.body || '';
  const paymentKeysExposed = [];
  if (/pk_live_[A-Za-z0-9]{10,}/.test(bodyText))  paymentKeysExposed.push('Stripe publishable key (pk_live_)');
  if (/sk_live_[A-Za-z0-9]{10,}/.test(bodyText))  paymentKeysExposed.push('Stripe SECRET key (sk_live_) — CRITICAL');
  if (/rk_live_[A-Za-z0-9]{10,}/.test(bodyText))  paymentKeysExposed.push('Stripe restricted key (rk_live_)');
  if (/pk_test_[A-Za-z0-9]{10,}/.test(bodyText))  paymentKeysExposed.push('Stripe test publishable key (pk_test_)');

  // Security headers assessment
  const sh = page.http?.security_headers || {};
  const headerIssues = [];
  if (!sh.hsts)               headerIssues.push('Missing HSTS (Strict-Transport-Security)');
  if (!sh.x_frame_options)    headerIssues.push('Missing X-Frame-Options (clickjacking risk)');
  if (!sh.csp)                headerIssues.push('Missing Content-Security-Policy');
  if (!sh.x_content_type)     headerIssues.push('Missing X-Content-Type-Options');
  if (!sh.referrer_policy)    headerIssues.push('Missing Referrer-Policy');
  if (!sh.permissions_policy) headerIssues.push('Missing Permissions-Policy');

  return {
    https:              isHttps,
    mixed_content:      mixedContent,
    mixed_content_count: mixedContent.length,
    exposed_files:      exposedFiles,
    exposed_files_count: Object.keys(exposedFiles).length,
    security_header_issues: headerIssues,
    wp_security:        wpProbes,
    wc_security:        wcProbes,
    payment_keys_exposed: paymentKeysExposed,
    iframe_sandbox:     $('iframe:not([sandbox])').length,
  };
}

// ─── PLATFORM DETECTION ───────────────────────────────────────────────────────

async function detectPlatform($, page, baseUrl) {
  const body  = page.body || '';
  const lower = body.toLowerCase();
  const h     = page.headers || {};
  const parsed = (() => { try { return new URL(baseUrl); } catch { return null; } })();
  const origin = parsed ? `${parsed.protocol}//${parsed.hostname}` : baseUrl;

  // ── WordPress ──
  const wpSignals = [];
  if (lower.includes('/wp-content/'))             wpSignals.push('wp-content path');
  if (lower.includes('/wp-includes/'))            wpSignals.push('wp-includes path');
  if (lower.includes('name="generator" content="wordpress')) wpSignals.push('meta generator');
  if (lower.includes('wp-emoji'))                 wpSignals.push('wp-emoji');
  if ((h['link'] || '').includes('api.w.org'))    wpSignals.push('Link header api.w.org');
  if ((h['x-generator'] || '').toLowerCase().includes('wordpress')) wpSignals.push('X-Generator header');

  // WP version from meta generator
  const wpVersionMatch = body.match(/content="WordPress\s+([\d.]+)"/i);
  const wpVersion = wpVersionMatch ? wpVersionMatch[1] : null;

  // Plugins exposed in HTML
  const pluginMatches = [...new Set((body.match(/\/wp-content\/plugins\/([a-z0-9_-]+)\//gi) || [])
    .map(m => m.match(/plugins\/([a-z0-9_-]+)\//i)?.[1]).filter(Boolean))];

  // Theme name
  const themeMatch = body.match(/\/wp-content\/themes\/([a-z0-9_-]+)\//i);
  const wpTheme = themeMatch ? themeMatch[1] : null;

  // WooCommerce
  const wcSignals = [];
  if (lower.includes('woocommerce'))    wcSignals.push('woocommerce string');
  if (lower.includes('wc-cart'))        wcSignals.push('wc-cart');
  if (lower.includes('add-to-cart'))    wcSignals.push('add-to-cart');
  if (lower.includes('/wc-api/'))       wcSignals.push('wc-api');

  // ── WP REST API probe (fast — already done in detector.js but we redo here) ──
  let wpRestData = null;
  if (wpSignals.length >= 1) {
    try {
      const r = await fetchUrl(`${origin}/wp-json/`);
      if (r.ok && r.body.includes('"name"')) {
        try {
          const data = JSON.parse(r.body.substring(0, 4000));
          wpRestData = {
            site_name:    data.name,
            description:  data.description,
            wp_version:   data.generator?.replace('https://wordpress.org/?v=', '') || wpVersion,
          };
        } catch { /* truncated JSON */ }
      }
    } catch { /* probe failed */ }
  }

  // ── Frontend frameworks ──
  let frontend = null;
  if (lower.includes('__next_data__') || lower.includes('/_next/'))           frontend = 'nextjs';
  else if (lower.includes('nuxt') && lower.includes('__nuxt'))                frontend = 'nuxtjs';
  else if (lower.includes('ng-version') || lower.includes('ng-app'))          frontend = 'angular';
  else if (lower.includes('data-reactroot') || lower.includes('__react'))     frontend = 'react';
  else if (lower.includes('__vue_') || lower.includes('data-v-'))             frontend = 'vue';
  else if (lower.includes('svelte') || lower.includes('__svelte'))            frontend = 'svelte';

  // ── Page builders ──
  let pageBuilder = null;
  if (lower.includes('elementor'))                                             pageBuilder = 'elementor';
  else if (lower.includes('wp-block-'))                                        pageBuilder = 'gutenberg';
  else if (lower.includes('et_pb_'))                                           pageBuilder = 'divi';
  else if (lower.includes('fl-builder') || lower.includes('beaver-builder'))  pageBuilder = 'beaver-builder';
  else if (lower.includes('vc_row') || lower.includes('visual-composer'))     pageBuilder = 'visual-composer';

  // ── Strapi CMS detection ──
  const strapiSignals = [];
  const poweredBy = (h['x-powered-by'] || '').toLowerCase();
  if (poweredBy.includes('strapi'))                            strapiSignals.push('x-powered-by header');
  if (lower.includes('"strapi"') || lower.includes('strapi-')) strapiSignals.push('strapi string in body');
  // Also detect via API shape: { data: [...], meta: { pagination: {...} } }
  if (lower.includes('"meta":') && lower.includes('"pagination"') && lower.includes('"data":')) {
    strapiSignals.push('strapi api response shape');
  }

  // Probe Strapi-specific endpoints (only if signals detected)
  const strapiProbes = {};
  if (strapiSignals.length >= 1) {
    try {
      const [adminProbe, apiProbe, graphqlProbe, corsProbe] = await Promise.all([
        // Admin panel accessible?
        probeUrl(`${origin}/admin`).then(r => ({ statusCode: r.statusCode })),
        // Public API endpoints accessible without auth?
        fetchUrl(`${origin}/api`, 'GET').then(r => ({ statusCode: r.statusCode, has_data: r.ok && r.body && r.body.includes('"data"') })),
        // GraphQL endpoint?
        postJson(`${origin}/graphql`, { query: '{ __schema { types { name } } }' }).then(r => ({
          statusCode:      r.statusCode,
          accessible:      r.statusCode === 200 || r.statusCode === 400,
          introspection:   r.ok && r.body && r.body.includes('__schema'),
        })),
        // CORS reflection: send fake origin, check if it's reflected
        probeOptions(origin, 'https://evil-attacker.com').then(r => ({
          reflects_origin:     r.ok && (r.headers['access-control-allow-origin'] || '') === 'https://evil-attacker.com',
          allows_credentials:  r.ok && r.headers['access-control-allow-credentials'] === 'true',
          cors_wildcard:       r.ok && (r.headers['access-control-allow-origin'] || '') === '*',
        })),
      ]);

      strapiProbes.admin_accessible   = adminProbe.statusCode === 200;
      strapiProbes.api_public         = apiProbe.has_data === true;
      strapiProbes.graphql_accessible = graphqlProbe.accessible === true;
      strapiProbes.graphql_introspection = graphqlProbe.introspection === true;
      strapiProbes.cors_reflects_origin = corsProbe.reflects_origin === true;
      strapiProbes.cors_wildcard        = corsProbe.cors_wildcard === true;
      strapiProbes.cors_credentials     = corsProbe.allows_credentials === true;
    } catch { /* probes failed — non-critical */ }
  }

  const isStrapi = strapiSignals.length >= 1;

  // ── Determine overall platform ──
  const isWP  = wpSignals.length >= 1 || !!wpRestData;
  const isWC  = wcSignals.length >= 1;
  const platform = isWC ? 'woocommerce' : isWP ? 'wordpress' : isStrapi ? 'strapi' : (frontend || 'html');

  return {
    platform,
    frontend_framework: frontend,
    page_builder:       pageBuilder,
    strapi: isStrapi ? {
      detected:          true,
      signals:           strapiSignals,
      probes:            strapiProbes,
    } : { detected: false },
    wordpress: isWP ? {
      detected:          true,
      signals:           wpSignals,
      version:           wpRestData?.wp_version || wpVersion,
      version_exposed:   !!(wpRestData?.wp_version || wpVersion),
      theme:             wpTheme,
      plugins_in_html:   pluginMatches,
      rest_api:          wpRestData,
    } : { detected: false },
    woocommerce: isWC ? {
      detected: true,
      signals:  wcSignals,
    } : { detected: false },
  };
}

// ─── CHECK BROKEN LINKS ───────────────────────────────────────────────────────

async function checkInternalLinks(links) {
  const toCheck = links.slice(0, LINK_CHECK_LIMIT);
  const results = await Promise.all(
    toCheck.map(async (href) => {
      const r = await probeUrl(href);
      return { url: href, status: r.statusCode || 0, broken: !r.ok };
    })
  );
  return {
    checked: results.length,
    broken:  results.filter(r => r.broken),
    broken_count: results.filter(r => r.broken).length,
  };
}

// ─── MAIN SCRAPE FUNCTION ─────────────────────────────────────────────────────

/**
 * Run the full scrape on a URL.
 * Returns a structured data object ready for claude-interpreter.js.
 *
 * @param {string} url
 * @returns {object} scraped data
 */
async function scrape(url) {
  const startTime = Date.now();

  // ── Fetch homepage ──
  const page = await fetchUrl(url);
  if (!page.ok) {
    return {
      url,
      error:       page.error || `HTTP ${page.statusCode}`,
      scraped_at:  new Date().toISOString(),
      duration_ms: Date.now() - startTime,
    };
  }

  // ── Parse HTML ──
  const $ = cheerio.load(page.body || '');

  // ── Run all analysis layers in parallel where possible ──
  const [seoData, securityData, platformData] = await Promise.all([
    analyseSeo($, page, page.finalUrl || url),
    analyseSecurity($, { http: analyseHttpLayer(page, url), headers: page.headers, body: page.body }, page.finalUrl || url),
    detectPlatform($, page, page.finalUrl || url),
  ]);

  const httpData    = analyseHttpLayer(page, url);
  const htmlData    = analyseHtmlStructure($, page.finalUrl || url);
  const perfData    = analysePerformance($, page);

  // ── Check a sample of internal links for 404s ──
  const linkCheck = await checkInternalLinks(htmlData.links.internal_sample);

  // ─────────────────────────────────────────────────────────────────────────
  return {
    url,
    final_url:   page.finalUrl || url,
    scraped_at:  new Date().toISOString(),
    duration_ms: Date.now() - startTime,

    http:        httpData,
    html:        htmlData,
    seo:         seoData,
    performance: perfData,
    security:    securityData,
    platform:    platformData,
    link_check:  linkCheck,
  };
}

// ─── LINK DISCOVERY ───────────────────────────────────────────────────────────

/**
 * Extract crawlable internal links from the homepage scrape result.
 * Returns all unique, normalised same-origin absolute URLs (no artificial cap —
 * the caller decides how many to fetch).
 *
 * @param {object} primary  - FullScrapedData from scrape()
 * @param {string} baseUrl  - canonical base URL (used to resolve relative refs)
 * @returns {string[]}
 */
function discoverLinks(primary, baseUrl) {
  let parsed;
  try { parsed = new URL(baseUrl); } catch { return []; }

  const origin    = `${parsed.protocol}//${parsed.hostname}`;
  const seenPaths = new Set();
  // Always skip the homepage itself (path "/" or same as the scraped path)
  seenPaths.add('/');
  const homePath = parsed.pathname.replace(/\/+$/, '') || '/';
  seenPaths.add(homePath);

  const candidates = [];
  const raw = primary.html?.links?.internal_sample || [];

  for (const href of raw) {
    let normUrl;
    try {
      const u = new URL(href, origin);
      // Same origin only
      if (`${u.protocol}//${u.hostname}` !== origin) continue;
      // No query strings, no fragments
      if (u.search || u.hash) continue;
      // Normalise: strip trailing slash (except root), lowercase the path
      const path = (u.pathname.replace(/\/+$/, '') || '/').toLowerCase();
      if (seenPaths.has(path)) continue;
      seenPaths.add(path);
      normUrl = `${origin}${path}`;
    } catch {
      continue;
    }

    // Skip static assets and non-content paths
    const lc = normUrl.toLowerCase();
    if (/\.(css|js|png|jpg|jpeg|gif|svg|ico|webp|avif|woff|woff2|ttf|eot|pdf|xml|json|zip|gz|tar)(\?|$)/.test(lc)) continue;
    if (/\/(wp-admin|wp-login|wp-cron|xmlrpc|feed|trackback|tag\/|category\/|author\/|page\/\d)/.test(lc)) continue;

    candidates.push(normUrl);
  }

  return candidates;
}

// ─── LIGHTWEIGHT PAGE SCRAPE ──────────────────────────────────────────────────

const PAGE_FETCH_TIMEOUT_MS = 10_000;

/**
 * Lightweight scrape of a single inner page.
 * HTTP GET + HTML parse only — no security probes, no WP/Strapi probes,
 * no robots/sitemap, no link-checking.
 *
 * @param {string} url
 * @returns {Promise<object|null>}  LightScrapedData, or null on fetch error / timeout
 */
async function scrapePage(url) {
  const timeoutPromise = new Promise(resolve =>
    setTimeout(() => resolve(null), PAGE_FETCH_TIMEOUT_MS)
  );

  const fetchPromise = (async () => {
    const page = await fetchUrl(url);
    // Network-level failure (no status code) → skip
    if (!page.ok && !page.statusCode) return null;

    const statusCode     = page.statusCode || 0;
    const responseTimeMs = page.responseTimeMs || 0;
    const body           = page.body || '';

    let $;
    try { $ = cheerio.load(body); } catch { $ = cheerio.load(''); }

    // ── SEO basics ──
    const titleText = $('title').first().text().trim();
    const metaDesc  = $('meta[name="description"]').attr('content') || null;
    const canonical = $('link[rel="canonical"]').attr('href') || null;

    // ── Headings ──
    const h1 = [], h2 = [];
    $('h1').each((_, el) => { const t = $(el).text().trim(); if (t) h1.push(t); });
    $('h2').each((_, el) => { const t = $(el).text().trim(); if (t) h2.push(t); });

    // ── Images ──
    let totalImages = 0, missingAlt = 0, emptyAlt = 0;
    $('img').each((_, el) => {
      totalImages++;
      const alt = $(el).attr('alt');
      if (alt === undefined) missingAlt++;
      if (alt === '')        emptyAlt++;
    });

    // ── Links ──
    let internalCount = 0, externalCount = 0, emptyTextCount = 0;
    let baseParsed;
    try { baseParsed = new URL(page.finalUrl || url); } catch { baseParsed = null; }
    const baseHost = baseParsed?.hostname || '';
    $('a[href]').each((_, el) => {
      const href       = $(el).attr('href') || '';
      const text       = $(el).text().trim();
      const ariaLabel  = $(el).attr('aria-label') || $(el).attr('title') || '';
      if (!text && !ariaLabel) emptyTextCount++;
      if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
      try {
        const abs = href.startsWith('http') ? new URL(href) : new URL(href, page.finalUrl || url);
        if (abs.hostname === baseHost) internalCount++;
        else externalCount++;
      } catch { /* malformed href */ }
    });

    // ── Semantic basics ──
    const langAttr = $('html').attr('lang') || null;
    const hasMain  = $('main').length > 0;
    const hasNav   = $('nav').length > 0;

    // ── Forms ──
    let inputsWithoutLabel = 0;
    $('form').each((_, formEl) => {
      $(formEl).find('input, textarea, select').each((_, inputEl) => {
        const id   = $(inputEl).attr('id');
        const type = $(inputEl).attr('type') || 'text';
        if (type === 'hidden' || type === 'submit') return;
        const hasLabel  = id ? $(`label[for="${id}"]`).length > 0 : false;
        const ariaLabel = $(inputEl).attr('aria-label');
        if (!hasLabel && !ariaLabel) inputsWithoutLabel++;
      });
    });

    // ── Duplicate IDs ──
    const allIds = [];
    $('[id]').each((_, el) => { allIds.push($(el).attr('id')); });
    const idCounts  = allIds.reduce((acc, id) => { acc[id] = (acc[id] || 0) + 1; return acc; }, {});
    const dupIdCount = Object.values(idCounts).filter(c => c > 1).length;

    // ── Performance basics ──
    const pageSizeBytes = page.bodyBytes || 0;
    let rbScripts = 0, rbStyles = 0;
    $('head script[src]').each((_, el) => {
      if (!$(el).attr('defer') && !$(el).attr('async')) rbScripts++;
    });
    $('head link[rel="stylesheet"]').each((_, el) => {
      const media = $(el).attr('media') || 'all';
      if (media === 'all' || media === 'screen' || !media) rbStyles++;
    });

    // ── Security basics ──
    const isHttps = (page.finalUrl || url).startsWith('https://');
    let mixedContentCount = 0;
    if (isHttps) {
      $('img[src^="http:"], script[src^="http:"], link[href^="http:"], iframe[src^="http:"]').each(() => {
        mixedContentCount++;
      });
    }

    return {
      url:              page.finalUrl || url,
      status_code:      statusCode,
      response_time_ms: responseTimeMs,
      seo: {
        title: {
          text:      titleText || null,
          missing:   !titleText,
          too_short: titleText.length > 0 && titleText.length < 30,
          too_long:  titleText.length > 60,
        },
        meta_description: {
          text:    metaDesc,
          missing: !metaDesc,
        },
        canonical,
        h1_count: h1.length,
      },
      html: {
        headings: { h1, h2 },
        images:   { total: totalImages, missing_alt: missingAlt, empty_alt: emptyAlt },
        links:    { internal_count: internalCount, external_count: externalCount, empty_text_count: emptyTextCount },
        semantic: { has_main: hasMain, has_nav: hasNav, lang_attr: langAttr },
        forms:    { total_inputs_without_label: inputsWithoutLabel },
        duplicate_ids_count: dupIdCount,
      },
      performance: {
        page_size_bytes: pageSizeBytes,
        render_blocking: { scripts_count: rbScripts, styles_count: rbStyles },
      },
      security: {
        https:               isHttps,
        mixed_content_count: mixedContentCount,
      },
    };
  })();

  return Promise.race([fetchPromise, timeoutPromise]);
}

// ─── MULTI-PAGE CRAWL ─────────────────────────────────────────────────────────

// Hard safety ceiling — prevents runaway crawls on sites with hundreds of links.
// All same-origin links discovered on the homepage are crawled up to this limit.
const MAX_INNER_PAGES  = 50;
const CRAWL_TIMEOUT_MS = 90_000;

/**
 * Full multi-page crawl.
 *
 * Fetches the homepage with the full scraper, discovers ALL same-origin internal
 * links (menu, footer, body — everything), then fetches them in parallel using
 * the lightweight scraper. Up to MAX_INNER_PAGES (50) inner pages are fetched.
 *
 * @param {string} url
 * @returns {Promise<{ primary: object, pages: object[] }>}
 */
async function crawl(url) {
  // Always do the full homepage scrape first
  const primary = await scrape(url);

  if (primary.error) {
    return { primary, pages: [] };
  }

  const baseUrl    = primary.final_url || url;
  const candidates = discoverLinks(primary, baseUrl);
  const toFetch    = candidates.slice(0, MAX_INNER_PAGES);

  if (toFetch.length === 0) {
    return { primary, pages: [] };
  }

  // Fetch all inner pages in parallel (each has its own 10 s per-page timeout).
  // Race the whole batch against CRAWL_TIMEOUT_MS so a slow site can't stall forever.
  const crawlPromise = Promise.all(
    toFetch.map(innerUrl => scrapePage(innerUrl))
  ).then(results => results.filter(Boolean)); // drop null (failed / timed-out pages)

  const timeoutPromise = new Promise(resolve =>
    setTimeout(() => resolve(null), CRAWL_TIMEOUT_MS)
  );

  const pages = await Promise.race([crawlPromise, timeoutPromise]) ?? [];

  return { primary, pages };
}

// ─── EXPORT ───────────────────────────────────────────────────────────────────

module.exports = { scrape, crawl, scrapePage, discoverLinks, fetchUrl, probeUrl };
