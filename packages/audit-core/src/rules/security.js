'use strict';
/**
 * Security Rules
 *
 * Sources / guidelines:
 *   - OWASP Secure Headers Project: https://owasp.org/www-project-secure-headers/
 *   - OWASP HTTP Security Response Headers Cheat Sheet
 *   - OWASP Session Management Cheat Sheet (cookie flags)
 *   - Mozilla Observatory: https://observatory.mozilla.org/
 *   - HSTS Preload: https://hstspreload.org/
 *   - W3C Content Security Policy Level 3
 *   - OWASP Clickjacking Defense Cheat Sheet
 *   - OWASP Transport Layer Protection Cheat Sheet
 *   - WordPress Security Whitepaper: https://wordpress.org/about/security/
 */

module.exports = [

  // ── Critical ───────────────────────────────────────────────────────────────

  {
    id: 'sec_no_https',
    category: 'Security',
    severity: 'critical',
    weight: 35,
    title: 'Site is not served over HTTPS',
    check: (d) => d.http?.https !== true,
    finding: () => 'The site is served over plain HTTP without encryption.',
    why: 'All data between the visitor and the server is transmitted in clear text. Passwords, form data, and personal information can be intercepted by anyone on the same network.',
    how_to_fix: 'Install a TLS/SSL certificate (free options include Let\'s Encrypt via Certbot) and configure the server to redirect all HTTP traffic to HTTPS. Most hosting providers offer this in one click.',
    impact: 'Protects all visitor data from interception and enables use of all modern browser security features.',
    reference: 'OWASP: Transport Layer Protection Cheat Sheet',
  },
  {
    id: 'sec_missing_hsts',
    category: 'Security',
    severity: 'critical',
    weight: 20,
    title: 'HSTS header is missing',
    check: (d) => !d.http?.security_headers?.hsts,
    finding: () => 'The Strict-Transport-Security (HSTS) header is not set.',
    why: 'Without HSTS, browsers do not know to always use HTTPS for this domain. Attackers can perform SSL-stripping attacks, silently downgrading connections to HTTP and intercepting traffic.',
    how_to_fix: 'Add the response header: Strict-Transport-Security: max-age=31536000; includeSubDomains. Configure this at the server or CDN level. Consider submitting to the HSTS Preload list for maximum protection.',
    impact: 'Browsers will always use HTTPS for your domain, eliminating downgrade attack risk.',
    reference: 'OWASP: HTTP Strict Transport Security Cheat Sheet',
  },
  {
    id: 'sec_missing_csp',
    category: 'Security',
    severity: 'critical',
    weight: 20,
    title: 'Content Security Policy (CSP) is missing',
    check: (d) => !d.http?.security_headers?.csp,
    finding: () => 'No Content-Security-Policy header was found.',
    why: 'Without CSP, your pages have no defence against Cross-Site Scripting (XSS) attacks, where malicious scripts are injected and run in visitors\' browsers. CSP is the primary browser-level XSS mitigation.',
    how_to_fix: 'Add a Content-Security-Policy header. Start with a basic policy: Content-Security-Policy: default-src \'self\'. Then expand it to allow your CDN, analytics, and other trusted sources. Test carefully to avoid breaking functionality.',
    impact: 'Prevents injected scripts from executing in visitors\' browsers, blocking XSS attacks.',
    reference: 'OWASP: Content Security Policy Cheat Sheet',
  },
  {
    id: 'sec_mixed_content',
    category: 'Security',
    severity: 'critical',
    weight: 25,
    title: 'Mixed content detected (HTTP on HTTPS)',
    check: (d) => (d.security?.mixed_content_count || 0) > 0,
    finding: (d) => `${d.security?.mixed_content_count} resource(s) are loaded over HTTP on this HTTPS page.`,
    why: 'Loading HTTP resources on an HTTPS page breaks the security model. Modern browsers block active mixed content (scripts, iframes) and warn about passive mixed content (images), eroding visitor trust.',
    how_to_fix: 'Update all resource URLs to use HTTPS. This includes images, scripts, stylesheets, and iframes. Do a site-wide search for "http://" in your templates and content.',
    impact: 'Restores full HTTPS security and eliminates browser warnings for visitors.',
    reference: 'OWASP: Transport Layer Protection',
  },
  {
    id: 'sec_exposed_files',
    category: 'Security',
    severity: 'critical',
    weight: 30,
    title: 'Sensitive files are publicly accessible',
    check: (d) => (d.security?.exposed_files_count || Object.keys(d.security?.exposed_files || {}).length) > 0,
    finding: (d) => {
      const files = Object.keys(d.security?.exposed_files || {}).join(', ');
      return `The following sensitive files are publicly accessible: ${files || 'multiple files detected'}.`;
    },
    why: 'Exposed files like .env, .git, composer.json, or backup files may contain database credentials, API keys, or application source code — directly enabling a site takeover.',
    how_to_fix: 'Block access to these files immediately via your web server configuration. Add rules to deny access to .env, .git/, .htaccess, and other sensitive paths. Move secret files outside the web root.',
    impact: 'Prevents attackers from reading credentials and source code that could lead to a full site compromise.',
    reference: 'OWASP: Sensitive Data Exposure',
  },

  // ── Warnings ───────────────────────────────────────────────────────────────

  {
    id: 'sec_missing_x_frame_options',
    category: 'Security',
    severity: 'warning',
    weight: 15,
    title: 'X-Frame-Options header is missing',
    check: (d) => !d.http?.security_headers?.x_frame_options,
    finding: () => 'The X-Frame-Options header is not set.',
    why: 'Without this header, your pages can be embedded inside iframes on malicious websites. Attackers use this for clickjacking — tricking users into clicking invisible buttons on your site.',
    how_to_fix: 'Add the response header: X-Frame-Options: SAMEORIGIN. This prevents your pages from being embedded on external sites. Alternatively, use CSP\'s frame-ancestors directive.',
    impact: 'Prevents clickjacking attacks where users are tricked into taking unintended actions on your site.',
    reference: 'OWASP: Clickjacking Defense Cheat Sheet',
  },
  {
    id: 'sec_missing_x_content_type',
    category: 'Security',
    severity: 'warning',
    weight: 10,
    title: 'X-Content-Type-Options header is missing',
    check: (d) => !d.http?.security_headers?.x_content_type,
    finding: () => 'The X-Content-Type-Options header is not set.',
    why: 'Without this header, browsers may try to "sniff" the content type of responses, which can allow certain XSS attacks via files uploaded or served with ambiguous content types.',
    how_to_fix: 'Add the response header: X-Content-Type-Options: nosniff. This is a single line and has zero risk of breaking functionality.',
    impact: 'Prevents MIME type sniffing attacks, closing a common XSS attack vector.',
    reference: 'OWASP: Secure Headers Project',
  },
  {
    id: 'sec_missing_referrer_policy',
    category: 'Security',
    severity: 'warning',
    weight: 10,
    title: 'Referrer-Policy header is missing',
    check: (d) => !d.http?.security_headers?.referrer_policy,
    finding: () => 'No Referrer-Policy header was found.',
    why: 'Without a Referrer-Policy, full URLs (including query strings with email addresses, tokens, or private paths) may be leaked to third-party sites when users click external links.',
    how_to_fix: 'Add the response header: Referrer-Policy: strict-origin-when-cross-origin. This is the recommended balanced policy per Mozilla.',
    impact: 'Prevents sensitive URL parameters from being leaked to third-party sites via the Referer header.',
    reference: 'Mozilla Observatory: Referrer Policy',
  },
  {
    id: 'sec_cookies_insecure',
    category: 'Security',
    severity: 'warning',
    weight: 15,
    title: 'Cookies missing Secure flag',
    check: (d) => (d.http?.cookies_without_secure || 0) > 0,
    finding: (d) => `${d.http?.cookies_without_secure} of ${d.http?.cookies_count} cookie(s) are set without the Secure flag.`,
    why: 'Cookies without the Secure flag can be transmitted over unencrypted HTTP connections, making them vulnerable to interception if a connection is downgraded.',
    how_to_fix: 'Set the Secure attribute on all cookies. In code: Set-Cookie: name=value; Secure; HttpOnly; SameSite=Lax. This applies to session cookies, authentication tokens, and any persistent cookies.',
    impact: 'Ensures cookies are only transmitted over encrypted connections, protecting session data from interception.',
    reference: 'OWASP: Session Management Cheat Sheet',
  },
  {
    id: 'sec_cookies_no_httponly',
    category: 'Security',
    severity: 'warning',
    weight: 10,
    title: 'Cookies missing HttpOnly flag',
    check: (d) => (d.http?.cookies_without_httponly || 0) > 0,
    finding: (d) => `${d.http?.cookies_without_httponly} cookie(s) are set without the HttpOnly flag.`,
    why: 'Cookies without HttpOnly are accessible to JavaScript. If an XSS attack succeeds, attackers can steal these cookies and take over user sessions.',
    how_to_fix: 'Add HttpOnly to all session and authentication cookies: Set-Cookie: name=value; HttpOnly. Only omit HttpOnly for cookies that genuinely need to be read by JavaScript.',
    impact: 'Prevents cookie theft via XSS, significantly reducing the impact of any script injection attack.',
    reference: 'OWASP: HttpOnly — Session Management Cheat Sheet',
  },
  {
    id: 'sec_cookies_no_samesite',
    category: 'Security',
    severity: 'warning',
    weight: 10,
    title: 'Cookies missing SameSite attribute',
    check: (d) => (d.http?.cookies_without_samesite || 0) > 0,
    finding: (d) => `${d.http?.cookies_without_samesite} cookie(s) are set without the SameSite attribute.`,
    why: 'Cookies without SameSite are sent on cross-site requests, enabling Cross-Site Request Forgery (CSRF) attacks where malicious sites trigger actions on your site using a logged-in user\'s session.',
    how_to_fix: 'Add SameSite=Lax or SameSite=Strict to all cookies. SameSite=Lax is the safe default and will not break standard navigation.',
    impact: 'Prevents CSRF attacks by ensuring cookies are not sent on cross-origin requests.',
    reference: 'OWASP: Cross-Site Request Forgery Prevention Cheat Sheet',
  },

  {
    id: 'sec_server_version_disclosed',
    category: 'Security',
    severity: 'warning',
    weight: 8,
    title: 'Server software version disclosed in response header',
    check: (d) => d.http?.server_version_exposed === true,
    finding: (d) => `The Server header reveals the software version: "${d.http?.server}". This discloses the exact server software and version to potential attackers.`,
    why: 'Knowing the exact server software version (e.g., Apache/2.4.41, nginx/1.18.0) lets attackers immediately look up known CVEs for that version and target unpatched vulnerabilities. Version disclosure is classified as information leakage under OWASP.',
    how_to_fix: 'In Apache: set "ServerTokens Prod" and "ServerSignature Off" in httpd.conf. In Nginx: set "server_tokens off" in nginx.conf. For IIS: remove version information via URL Scan or custom headers.',
    impact: 'Attackers cannot immediately identify server version-specific vulnerabilities without additional reconnaissance.',
    reference: 'OWASP: Information Exposure Through Server-Side Error Messages',
  },
  {
    id: 'sec_php_version_disclosed',
    category: 'Security',
    severity: 'warning',
    weight: 8,
    title: 'PHP version disclosed via X-Powered-By header',
    check: (d) => d.http?.php_version_exposed === true,
    finding: (d) => `The X-Powered-By header exposes the PHP version: "${d.http?.powered_by}".`,
    why: 'Disclosed PHP versions allow attackers to target known PHP security vulnerabilities. End-of-life PHP versions (anything below 8.1) have unpatched CVEs that are actively exploited. X-Powered-By is a frequently overlooked information leakage vector.',
    how_to_fix: 'In php.ini: set "expose_php = Off". This removes the X-Powered-By: PHP header entirely. Alternatively, configure your web server to strip this header before it reaches clients.',
    impact: 'Prevents targeted exploitation of PHP-specific vulnerabilities based on version disclosure.',
    reference: 'OWASP: Improper Error Handling — Information Disclosure',
  },

  // ── Info ───────────────────────────────────────────────────────────────────

  {
    id: 'sec_missing_permissions_policy',
    category: 'Security',
    severity: 'info',
    weight: 5,
    title: 'Permissions-Policy header is missing',
    check: (d) => !d.http?.security_headers?.permissions_policy,
    finding: () => 'No Permissions-Policy header was found.',
    why: 'The Permissions-Policy header controls which browser APIs (camera, microphone, geolocation) are available on the page and to embedded iframes.',
    how_to_fix: 'Add a Permissions-Policy header restricting APIs you don\'t use. Example: Permissions-Policy: camera=(), microphone=(), geolocation=().',
    impact: 'Reduces the attack surface by disabling powerful APIs that your site does not require.',
    reference: 'Permissions Policy Spec (W3C)',
  },
  {
    id: 'sec_iframe_no_sandbox',
    category: 'Security',
    severity: 'info',
    weight: 5,
    title: 'Iframes without sandbox attribute',
    check: (d) => (d.security?.iframe_sandbox || 0) > 0,
    finding: (d) => `${d.security?.iframe_sandbox} iframe(s) are present without the sandbox attribute.`,
    why: 'Unsandboxed iframes from third-party sources can run scripts, submit forms, and access the parent page\'s context, potentially creating security risks.',
    how_to_fix: 'Add sandbox="allow-scripts allow-same-origin" (or more restrictive) to all third-party iframes. Only grant the permissions the iframe actually needs.',
    impact: 'Limits what embedded third-party content can do, reducing the risk from compromised or malicious embeds.',
    reference: 'HTML Living Standard: iframe sandbox attribute',
  },

  // ── Positive ───────────────────────────────────────────────────────────────

  {
    id: 'sec_https_ok',
    category: 'Security',
    severity: 'positive',
    weight: 0,
    title: 'Site served over HTTPS',
    check: (d) => d.http?.https === true,
    finding: () => 'The site is served over HTTPS, encrypting all traffic between visitors and the server.',
    why: 'HTTPS is the foundation of web security and a requirement for all modern security features.',
    how_to_fix: 'No action required.',
    impact: 'All visitor data is encrypted in transit.',
    reference: 'OWASP: Transport Layer Protection',
  },
  {
    id: 'sec_no_mixed_content',
    category: 'Security',
    severity: 'positive',
    weight: 0,
    title: 'No mixed content detected',
    check: (d) => d.http?.https === true && (d.security?.mixed_content_count || 0) === 0,
    finding: () => 'No HTTP resources were found loaded on this HTTPS page.',
    why: 'Clean HTTPS without mixed content ensures the full security and trust benefits of encryption.',
    how_to_fix: 'No action required.',
    impact: 'Full HTTPS security is maintained — no browser warnings for visitors.',
    reference: 'OWASP: Transport Layer Protection',
  },
];
