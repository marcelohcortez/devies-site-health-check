'use strict';
/**
 * Performance Rules
 *
 * Sources / guidelines:
 *   - Google Lighthouse: https://developer.chrome.com/docs/lighthouse/
 *   - web.dev performance guides: https://web.dev/performance/
 *   - Core Web Vitals: https://web.dev/vitals/
 *   - HTTP/2 and caching best practices
 *   - Google PageSpeed Insights: https://pagespeed.web.dev/
 *   - Lighthouse: render-blocking resources audit
 *   - web.dev: Efficiently encode images
 *   - web.dev: Lazy-load images
 *   - web.dev: Use cache-control
 */

module.exports = [

  // ── Warnings ───────────────────────────────────────────────────────────────

  {
    id: 'perf_render_blocking_scripts',
    category: 'Performance',
    severity: 'warning',
    weight: 15,
    title: 'Render-blocking scripts in <head>',
    check: (d) => (d.performance?.render_blocking?.scripts_count || 0) > 0,
    finding: (d) => {
      const count   = d.performance?.render_blocking?.scripts_count || 0;
      const scripts = (d.performance?.render_blocking?.scripts || []).slice(0, 3).join(', ');
      return `${count} script(s) in <head> without defer or async are blocking rendering${scripts ? ': ' + scripts : ''}.`;
    },
    why: 'Render-blocking scripts force the browser to stop building the page until each script is downloaded and executed. Every millisecond of blocking delay increases bounce rate and harms Core Web Vitals.',
    how_to_fix: 'Add defer or async attributes to <script> tags that do not need to run before the page renders. Scripts that are not critical for initial display should be deferred. Example: <script src="..." defer>.',
    impact: 'Reduces time-to-first-paint and perceived load speed, directly improving Core Web Vitals and user experience.',
    reference: 'Lighthouse: Eliminate render-blocking resources',
  },
  {
    id: 'perf_render_blocking_styles',
    category: 'Performance',
    severity: 'warning',
    weight: 10,
    title: 'Render-blocking stylesheets in <head>',
    check: (d) => (d.performance?.render_blocking?.styles_count || 0) > 0,
    finding: (d) => {
      const count = d.performance?.render_blocking?.styles_count || 0;
      return `${count} stylesheet(s) in <head> are blocking rendering. The browser must fully download these before displaying anything.`;
    },
    why: 'Stylesheets in <head> are render-blocking by default. The browser cannot show the page until all blocking CSS is downloaded, parsed, and applied.',
    how_to_fix: 'Inline critical CSS (the styles needed for above-the-fold content) and load non-critical stylesheets asynchronously using the media="print" trick or a JavaScript loader. Consolidate multiple stylesheets into one.',
    impact: 'Pages begin rendering sooner, improving time-to-first-paint and the user experience on slow connections.',
    reference: 'Lighthouse: Eliminate render-blocking resources',
  },
  {
    id: 'perf_no_lazy_loading',
    category: 'Performance',
    severity: 'warning',
    weight: 15,
    title: 'Images not using lazy loading',
    check: (d) => {
      const total = d.html?.images?.total || 0;
      const lazy  = d.html?.images?.with_lazy_loading || 0;
      return total > 3 && lazy === 0;
    },
    finding: (d) => {
      const total = d.html?.images?.total || 0;
      return `All ${total} images load immediately on page open, including those far below the visible area.`;
    },
    why: 'Loading all images at once wastes bandwidth for visitors who never scroll that far, slowing initial page load. This directly harms Core Web Vitals (LCP) and increases mobile data usage.',
    how_to_fix: 'Add loading="lazy" to all <img> tags that are not in the first visible area of the page (above the fold). This is a one-attribute change per image and is supported by all modern browsers with no JavaScript required.',
    impact: 'Reduces initial page load time and data transfer, especially on mobile. Can noticeably improve Core Web Vitals LCP score.',
    reference: 'web.dev: Lazy-load images and video',
  },
  {
    id: 'perf_legacy_image_formats',
    category: 'Performance',
    severity: 'warning',
    weight: 10,
    title: 'Images using outdated formats',
    check: (d) => (d.html?.images?.legacy_formats || 0) > 0 && (d.html?.images?.modern_formats || 0) === 0,
    finding: (d) => `All ${d.html?.images?.legacy_formats || 0} content images use legacy formats (JPG, PNG, or GIF). No WebP or AVIF images were detected.`,
    why: 'WebP images are 25–35% smaller than equivalent JPG/PNG files with no visible quality difference. Smaller images mean faster load times, especially on mobile connections.',
    how_to_fix: 'Convert images to WebP format using tools like Squoosh (free), Cloudinary, or your CMS\'s image processing. Use <picture> tags to serve WebP with a JPG fallback for older browsers. Many CDN providers offer automatic format conversion.',
    impact: 'Reducing image file sizes by up to 35% can significantly improve page load speed and Core Web Vitals scores.',
    reference: 'web.dev: Use WebP images',
  },
  {
    id: 'perf_large_page',
    category: 'Performance',
    severity: 'warning',
    weight: 20,
    title: 'Page HTML size is very large',
    check: (d) => (d.performance?.page_size_kb || 0) > 1000,
    finding: (d) => `The page HTML is ${d.performance?.page_size_kb || 0} KB — significantly above the recommended maximum of 500 KB.`,
    why: 'Excessively large HTML documents take longer to download, parse, and render. This is especially problematic for visitors on mobile connections.',
    how_to_fix: 'Review what is generating the large HTML. Common causes include inline data, large JSON blobs embedded in the page, duplicate content, or bloated CMS output. Consider server-side rendering optimisations or pagination for large datasets.',
    impact: 'Reducing HTML size directly speeds up page load, improving both user experience and Core Web Vitals.',
    reference: 'Lighthouse: Avoid an excessive DOM size',
  },
  {
    id: 'perf_medium_page',
    category: 'Performance',
    severity: 'info',
    weight: 5,
    title: 'Page HTML size is above optimal',
    check: (d) => {
      const size = d.performance?.page_size_kb || 0;
      return size > 300 && size <= 1000;
    },
    finding: (d) => `The page HTML is ${d.performance?.page_size_kb || 0} KB. The recommended target is under 300 KB for optimal load performance.`,
    why: 'Larger HTML documents take longer to download and parse, which can contribute to slower page load times.',
    how_to_fix: 'Consider enabling HTML compression (gzip/Brotli) on your server if not already active. Review if any large inline content can be moved to separate files loaded asynchronously.',
    impact: 'Faster HTML download and parse time, contributing to improved page load performance.',
    reference: 'web.dev: Reduce network payloads',
  },
  {
    id: 'perf_no_preload',
    category: 'Performance',
    severity: 'info',
    weight: 5,
    title: 'No resource preload hints',
    check: (d) => (d.performance?.preload_hints || 0) === 0,
    finding: () => 'No <link rel="preload"> hints were found. The browser discovers critical resources only as it reads through the page.',
    why: 'Preload hints allow the browser to start downloading important resources (hero images, key fonts, critical scripts) before it discovers them in the page body, reducing time to first meaningful display.',
    how_to_fix: 'Add <link rel="preload" as="image" href="..."> for the main above-the-fold image and <link rel="preload" as="font"> for critical fonts. Only preload resources needed for first render.',
    impact: 'Can reduce time to first meaningful paint, improving perceived load speed for visitors.',
    reference: 'web.dev: Preload critical assets',
  },
  {
    id: 'perf_short_cache',
    category: 'Performance',
    severity: 'info',
    weight: 5,
    title: 'Cache duration is very short',
    check: (d) => {
      const cc = d.http?.cache?.cache_control || '';
      const match = cc.match(/max-age=(\d+)/);
      if (!match) return false;
      return parseInt(match[1]) < 60;
    },
    finding: (d) => {
      const cc    = d.http?.cache?.cache_control || '';
      const match = cc.match(/max-age=(\d+)/);
      const secs  = match ? match[1] : '?';
      return `The page cache duration is ${secs} seconds. Repeat visitors must re-download the page on almost every visit.`;
    },
    why: 'A very short cache means every visit results in a fresh server request. For pages that don\'t change frequently, this unnecessarily increases server load and slows repeat visits.',
    how_to_fix: 'Increase the cache duration for the homepage to at least 5–10 minutes (300–600 seconds) if content doesn\'t change frequently. Static assets (images, CSS, JS) should be cached for days or weeks.',
    impact: 'Repeat visitors will experience faster load times and server load will reduce during traffic spikes.',
    reference: 'web.dev: HTTP caching',
  },
  {
    id: 'perf_no_cdn',
    category: 'Performance',
    severity: 'info',
    weight: 5,
    title: 'No CDN detected',
    check: (d) => d.http?.cache?.cdn_detected !== true,
    finding: () => 'No CDN (Content Delivery Network) was detected. All requests are served from a single origin server.',
    why: 'A CDN caches and serves content from servers geographically close to each visitor, reducing latency. Without one, visitors far from the server experience slower load times.',
    how_to_fix: 'Consider using a CDN such as Cloudflare (has a free tier), Fastly, or your hosting provider\'s CDN. Cloudflare is the simplest option — just change your DNS to point through it.',
    impact: 'Reduced latency for visitors geographically distant from the server. Cloudflare\'s free tier also adds DDoS protection.',
    reference: 'web.dev: Content delivery networks (CDNs)',
  },

  // ── Positive ───────────────────────────────────────────────────────────────

  {
    id: 'perf_fast_response',
    category: 'Performance',
    severity: 'positive',
    weight: 0,
    title: 'Fast server response time',
    check: (d) => (d.http?.response_time_ms || 9999) <= 500,
    finding: (d) => `The server responded in ${d.http?.response_time_ms} ms, which is within the recommended 500 ms threshold.`,
    why: 'A fast server response time means less time before the browser can begin rendering content for the visitor.',
    how_to_fix: 'No action required.',
    impact: 'Fast server response is the foundation of good page load performance.',
    reference: 'Lighthouse: Reduce server response times (TTFB)',
  },
  {
    id: 'perf_cdn_detected',
    category: 'Performance',
    severity: 'positive',
    weight: 0,
    title: 'CDN detected',
    check: (d) => d.http?.cache?.cdn_detected === true,
    finding: () => 'A CDN is in use, serving content from geographically distributed edge nodes.',
    why: 'CDNs reduce latency for visitors worldwide by serving content from nearby servers.',
    how_to_fix: 'No action required.',
    impact: 'Faster load times for visitors regardless of their geographic location.',
    reference: 'web.dev: Content delivery networks (CDNs)',
  },
  {
    id: 'perf_lazy_loading_ok',
    category: 'Performance',
    severity: 'positive',
    weight: 0,
    title: 'Images use lazy loading',
    check: (d) => (d.html?.images?.with_lazy_loading || 0) > 0,
    finding: (d) => `${d.html?.images?.with_lazy_loading} image(s) use lazy loading, deferring their load until they enter the viewport.`,
    why: 'Lazy loading reduces unnecessary data transfer and speeds up the initial page load.',
    how_to_fix: 'No action required.',
    impact: 'Faster initial page load, especially on image-heavy pages.',
    reference: 'web.dev: Lazy-load images and video',
  },
];
