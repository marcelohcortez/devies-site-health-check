'use strict';
/**
 * WordPress & WooCommerce Rules
 *
 * Sources / guidelines:
 *   - WordPress Security Whitepaper: https://wordpress.org/about/security/
 *   - WordPress Hardening Guide: https://developer.wordpress.org/advanced-administration/security/hardening/
 *   - WPScan Vulnerability Database
 *   - WooCommerce Security Best Practices: https://woocommerce.com/document/ssl-and-https/
 *   - Sucuri WordPress Security: https://sucuri.net/guides/wordpress-security/
 *   - Wordfence Security Blog
 *   - OWASP: WordPress Security Cheat Sheet
 *
 * Note: These rules only fire if WordPress/WooCommerce is detected on the site.
 */

const WP_RULES = [

  // ── Critical ─────────────────────────────────────────────────────────────

  {
    id: 'wp_config_backup_exposed',
    category: 'WordPress',
    severity: 'critical',
    weight: 30,
    title: 'wp-config.php backup file publicly accessible',
    check: (d) => d.platform?.wordpress?.detected && d.security?.wp_security?.config_backup_exposed === true,
    finding: () => 'A backup of wp-config.php (e.g. wp-config.php.bak, .old, .orig) is publicly accessible, exposing database credentials.',
    why: 'wp-config.php contains the WordPress database host, username, password, and secret keys. A publicly accessible backup of this file hands attackers full database access, enabling them to extract all user data, inject backdoors, or take over the site entirely.',
    how_to_fix: 'Delete all backup copies of wp-config.php from the server immediately. Block access to any .bak, .old, .orig, and .save files at the server level. In Nginx: location ~* \\.bak$ { deny all; }. In Apache: <FilesMatch "\\.(bak|old|orig|save)$"> deny from all </FilesMatch>.',
    impact: 'Prevents complete site compromise via database credential theft.',
    reference: 'WPScan Security Checklist: https://wpscan.com/blog/wordpress-security-checklist/',
  },
  {
    id: 'wp_debug_log_exposed',
    category: 'WordPress',
    severity: 'critical',
    weight: 25,
    title: 'WordPress debug.log publicly accessible',
    check: (d) => d.platform?.wordpress?.detected && d.security?.wp_security?.debug_log_exposed === true,
    finding: () => 'The WordPress debug log (/wp-content/debug.log) is publicly accessible, exposing server paths, credentials, and application errors.',
    why: 'debug.log can contain database query errors with table names and data, file system paths that reveal server structure, email addresses, and in some cases partial credentials or API keys logged during errors. It is one of the first files attackers check after finding WP_DEBUG was enabled.',
    how_to_fix: 'Disable WP_DEBUG in wp-config.php (set WP_DEBUG to false in production). Block public access to the debug log: In Nginx: location = /wp-content/debug.log { deny all; }. Alternatively, use a security plugin to relocate logs outside the webroot.',
    impact: 'Prevents information disclosure that assists attackers in targeting specific vulnerabilities.',
    reference: 'WordPress Hardening Guide: https://developer.wordpress.org/advanced-administration/security/hardening/',
  },
  {
    id: 'wp_xmlrpc_accessible',
    category: 'WordPress',
    severity: 'critical',
    weight: 25,
    title: 'xmlrpc.php is publicly accessible',
    check: (d) => d.platform?.wordpress?.detected && d.security?.wp_security?.xmlrpc === true,
    finding: () => 'The file xmlrpc.php is accessible, enabling remote API calls to the WordPress installation.',
    why: 'xmlrpc.php is a frequent target for brute-force attacks and DDoS amplification. Attackers can attempt thousands of password combinations in a single request, and it has been exploited in numerous WordPress compromises. Most modern WordPress sites do not need xmlrpc.php.',
    how_to_fix: 'Block xmlrpc.php access at the server level. In Apache (.htaccess): <Files xmlrpc.php> Order Deny,Allow Deny from all </Files>. In Nginx: location = /xmlrpc.php { deny all; }. Alternatively, use a security plugin like Wordfence or Sucuri which block it automatically.',
    impact: 'Eliminates a primary brute-force and DDoS attack vector, significantly hardening the WordPress installation.',
    reference: 'WordPress Hardening Guide: Disable XML-RPC',
  },
  {
    id: 'wp_user_enumeration',
    category: 'WordPress',
    severity: 'critical',
    weight: 20,
    title: 'WordPress user enumeration possible',
    check: (d) => d.platform?.wordpress?.detected && d.security?.wp_security?.user_enum === true,
    finding: () => 'WordPress usernames can be enumerated via the REST API (/wp-json/wp/v2/users), exposing administrator usernames.',
    why: 'Knowing a valid username removes half the information needed for a brute-force attack. Attackers routinely enumerate WordPress users before attempting to crack passwords.',
    how_to_fix: 'Disable user enumeration by adding this to functions.php: add_filter(\'rest_endpoints\', function($endpoints){ if(isset($endpoints[\'/wp/v2/users\'])){ unset($endpoints[\'/wp/v2/users\']); } return $endpoints; }); Alternatively, use a security plugin to block this automatically.',
    impact: 'Makes brute-force attacks significantly harder by hiding valid usernames from attackers.',
    reference: 'WPScan: User Enumeration',
  },

  // ── Warnings ─────────────────────────────────────────────────────────────

  {
    id: 'wp_version_exposed',
    category: 'WordPress',
    severity: 'warning',
    weight: 15,
    title: 'WordPress version exposed in HTML',
    check: (d) => d.platform?.wordpress?.detected && d.platform?.wordpress?.version_exposed === true,
    finding: (d) => `The WordPress version (${d.platform?.wordpress?.version || 'unknown'}) is visible in the page HTML source.`,
    why: 'Knowing the exact WordPress version allows attackers to look up known vulnerabilities for that specific version and target them precisely. Version disclosure is considered information leakage.',
    how_to_fix: 'Remove the WordPress version from the HTML by adding this to functions.php: remove_action(\'wp_head\', \'wp_generator\');. Also remove it from RSS feeds and other output points. A security plugin can do this automatically.',
    impact: 'Reduces targeted attacks by hiding version-specific vulnerability information from attackers.',
    reference: 'WordPress Hardening Guide: Hide WordPress version',
  },
  {
    id: 'wp_plugins_exposed',
    category: 'WordPress',
    severity: 'warning',
    weight: 10,
    title: 'Plugin names visible in HTML',
    check: (d) => d.platform?.wordpress?.detected && (d.platform?.wordpress?.plugins_in_html?.length || 0) > 0,
    finding: (d) => {
      const plugins = (d.platform?.wordpress?.plugins_in_html || []).slice(0, 5).join(', ');
      return `Plugin names are visible in the page source: ${plugins}. Attackers can use this to find known vulnerabilities in these specific plugins.`;
    },
    why: 'Exposed plugin names allow attackers to check each plugin against vulnerability databases and exploit known weaknesses without needing to guess which plugins are installed.',
    how_to_fix: 'Use a security plugin to obfuscate plugin paths. Alternatively, configure your server to block direct access to wp-content/plugins/. Some themes and plugins allow removing version numbers from asset URLs.',
    impact: 'Reduces targeted plugin vulnerability exploitation by hiding the installed plugin list.',
    reference: 'WordPress Security: Protecting wp-content',
  },
  {
    id: 'wp_admin_accessible',
    category: 'WordPress',
    severity: 'warning',
    weight: 10,
    title: 'WordPress admin login at default URL',
    check: (d) => d.platform?.wordpress?.detected && d.security?.wp_security?.wp_admin === true,
    finding: () => 'The WordPress admin login (/wp-admin) is accessible at the default URL.',
    why: 'The default wp-admin URL is universally known and is the first place automated bots target for brute-force login attempts. Moving or restricting it reduces automated attack volume.',
    how_to_fix: 'Consider using a plugin like WPS Hide Login to change the admin URL. Additionally, restrict access to /wp-admin by IP address in your server config if possible.',
    impact: 'Reduces automated brute-force attack volume by moving away from the universally targeted default admin URL.',
    reference: 'WordPress Hardening Guide: Change the Default Login URL',
  },

  {
    id: 'wp_author_enumeration',
    category: 'WordPress',
    severity: 'warning',
    weight: 10,
    title: 'WordPress usernames enumerable via author URL redirect',
    check: (d) => d.platform?.wordpress?.detected && d.security?.wp_security?.author_enum_url === true,
    finding: () => 'The URL /?author=1 redirects to /author/<username>/, exposing the administrator username.',
    why: 'Knowing a valid username (especially the admin) cuts brute-force attack cost in half. Automated WordPress attack tools routinely enumerate usernames via this redirect before attempting password attacks.',
    how_to_fix: 'Add a redirect rule to block the /?author= query: In .htaccess: RewriteCond %{QUERY_STRING} ^author=\\d RewriteRule ^ /? [L,R=301]. Or use a security plugin (Wordfence, iThemes Security) which blocks author enumeration automatically.',
    impact: 'Makes brute-force login attacks harder by hiding valid administrator usernames.',
    reference: 'WPScan: Author Enumeration — https://blog.wpscan.com/wordpress-user-enumeration/',
  },
  {
    id: 'wp_directory_listing',
    category: 'WordPress',
    severity: 'warning',
    weight: 15,
    title: 'WordPress uploads directory listing enabled',
    check: (d) => d.platform?.wordpress?.detected && d.security?.wp_security?.directory_listing_uploads === true,
    finding: () => 'Directory listing is enabled on /wp-content/uploads/, exposing all uploaded file names and paths.',
    why: 'Directory listing reveals every uploaded file, including file names that may expose personal data, document names, or internal file structure. Attackers can also discover unlisted files (backups, exports) stored in the uploads directory.',
    how_to_fix: 'Add "Options -Indexes" to the .htaccess file in /wp-content/uploads/ or at the server root. In Nginx: autoindex off; Most managed hosting providers disable directory listing by default, so check your server config.',
    impact: 'Prevents mass enumeration of all uploaded files and protects uploaded documents from discovery.',
    reference: 'WordPress Hardening Guide: https://developer.wordpress.org/advanced-administration/security/hardening/',
  },
  {
    id: 'wp_readme_exposed',
    category: 'WordPress',
    severity: 'warning',
    weight: 10,
    title: 'WordPress readme.html publicly accessible',
    check: (d) => d.platform?.wordpress?.detected && d.security?.wp_security?.readme_exposed === true,
    finding: () => 'The file /readme.html is publicly accessible, exposing the WordPress version number.',
    why: 'readme.html contains the exact WordPress version number, giving attackers a precise target to look up version-specific vulnerabilities. This is one of the first files checked by automated WordPress scanners.',
    how_to_fix: 'Delete or rename readme.html from the server root. In Apache: <Files readme.html> deny from all </Files>. In Nginx: location = /readme.html { deny all; }. A security plugin like Wordfence can block this automatically.',
    impact: 'Prevents automated scanners from easily obtaining the WordPress version number.',
    reference: 'WPScan Security Checklist: https://wpscan.com/blog/wordpress-security-checklist/',
  },
  {
    id: 'wp_license_exposed',
    category: 'WordPress',
    severity: 'info',
    weight: 5,
    title: 'WordPress license.txt publicly accessible',
    check: (d) => d.platform?.wordpress?.detected && d.security?.wp_security?.license_exposed === true,
    finding: () => 'The file /license.txt is publicly accessible, which also reveals the WordPress version.',
    why: 'Like readme.html, license.txt contains version information that automated tools use to identify the WordPress installation version.',
    how_to_fix: 'Block access to license.txt at the server level. In Nginx: location = /license.txt { deny all; }. In Apache: add a Files directive to .htaccess.',
    impact: 'Reduces information leakage about the WordPress installation.',
    reference: 'WPScan Security Checklist: https://wpscan.com/blog/wordpress-security-checklist/',
  },

  {
    id: 'wp_cron_accessible',
    category: 'WordPress',
    severity: 'warning',
    weight: 12,
    title: 'wp-cron.php publicly accessible',
    check: (d) => d.platform?.wordpress?.detected && d.security?.wp_security?.wp_cron === true,
    finding: () => 'The file /wp-cron.php returns HTTP 200 and is publicly accessible.',
    why: 'wp-cron.php is WordPress\'s scheduled task runner. When publicly accessible, attackers can trigger it repeatedly via HTTP — causing expensive database queries and scheduled tasks to run on demand, leading to DDoS-style resource exhaustion on the server. It also reveals internal scheduling logic.',
    how_to_fix: 'Disable the built-in cron by adding "define(\'DISABLE_WP_CRON\', true);" to wp-config.php, then configure a real server-side cron job (crontab) to call wp-cron.php internally. Alternatively, block public HTTP access: In Nginx: location = /wp-cron.php { deny all; }.',
    impact: 'Prevents resource exhaustion attacks and removes an information disclosure vector.',
    reference: 'WordPress Hardening Guide: https://developer.wordpress.org/advanced-administration/security/hardening/',
  },

  // ── Info ─────────────────────────────────────────────────────────────────

  {
    id: 'wp_pingback_enabled',
    category: 'WordPress',
    severity: 'info',
    weight: 5,
    title: 'WordPress pingback (X-Pingback header) enabled',
    check: (d) => d.platform?.wordpress?.detected && !!d.http?.pingback_header,
    finding: (d) => `The X-Pingback header is present (${d.http?.pingback_header}), advertising the XML-RPC pingback endpoint.`,
    why: 'The X-Pingback header advertises the xmlrpc.php pingback endpoint. Even if XML-RPC is partially restricted, pingback can be abused for Server-Side Request Forgery (SSRF) to probe internal networks, and for DDoS reflection attacks against third-party targets using your server as an amplifier.',
    how_to_fix: 'Remove the X-Pingback header by adding this to functions.php: add_filter(\'wp_headers\', function($headers) { unset($headers[\'X-Pingback\']); return $headers; }); Also disable pingbacks in Settings → Discussion → uncheck "Allow link notifications from other blogs".',
    impact: 'Removes a DDoS amplification vector and closes a potential SSRF path.',
    reference: 'WordPress Security: Disable Pingbacks',
  },
  {
    id: 'wp_no_security_headers',
    category: 'WordPress',
    severity: 'info',
    weight: 5,
    title: 'WordPress site missing security headers',
    check: (d) => {
      if (!d.platform?.wordpress?.detected) return false;
      const sh = d.http?.security_headers || {};
      return !sh.csp || !sh.hsts || !sh.x_frame_options;
    },
    finding: () => 'The WordPress site is missing recommended security headers. This is a WordPress-specific note in addition to the general security header findings.',
    why: 'WordPress sites are high-value targets. Security headers are a critical defence layer that should be configured at the server level for any WordPress installation.',
    how_to_fix: 'Add security headers via your web server config, hosting control panel, or the Headers and Redirects WordPress plugin. Ensure HSTS, CSP, and X-Frame-Options are all set.',
    impact: 'Reduces the attack surface for XSS, clickjacking, and protocol downgrade attacks on your WordPress installation.',
    reference: 'WordPress Hardening Guide: Security Headers',
  },

  // ── Positive ─────────────────────────────────────────────────────────────

  {
    id: 'wp_version_hidden',
    category: 'WordPress',
    severity: 'positive',
    weight: 0,
    title: 'WordPress version is not exposed',
    check: (d) => d.platform?.wordpress?.detected && d.platform?.wordpress?.version_exposed !== true,
    finding: () => 'The WordPress version is not visible in the page HTML source.',
    why: 'Hiding the WordPress version prevents targeted attacks based on version-specific vulnerabilities.',
    how_to_fix: 'No action required.',
    impact: 'Attackers cannot identify version-specific vulnerabilities without additional discovery methods.',
    reference: 'WordPress Hardening Guide: Hide WordPress version',
  },
  {
    id: 'wp_xmlrpc_blocked',
    category: 'WordPress',
    severity: 'positive',
    weight: 0,
    title: 'xmlrpc.php is blocked',
    check: (d) => d.platform?.wordpress?.detected && d.security?.wp_security?.xmlrpc === false,
    finding: () => 'xmlrpc.php is not accessible, eliminating this common attack vector.',
    why: 'Blocking xmlrpc.php prevents brute-force amplification attacks and reduces attack surface.',
    how_to_fix: 'No action required.',
    impact: 'A major WordPress attack vector is closed.',
    reference: 'WordPress Hardening Guide: Disable XML-RPC',
  },
];

// WooCommerce rules (only fire if WooCommerce is detected)
const WC_RULES = [
  {
    id: 'wc_no_https',
    category: 'WooCommerce',
    severity: 'critical',
    weight: 40,
    title: 'WooCommerce store not served over HTTPS',
    check: (d) => d.platform?.woocommerce?.detected && d.http?.https !== true,
    finding: () => 'This WooCommerce store is not served over HTTPS.',
    why: 'Payment card data, customer names, addresses, and order details transmitted without HTTPS encryption can be intercepted. This also violates PCI DSS compliance requirements for any store accepting card payments.',
    how_to_fix: 'Install an SSL certificate immediately and redirect all HTTP traffic to HTTPS. WooCommerce has built-in SSL enforcement settings. This is a critical compliance requirement.',
    impact: 'Protects customer payment and personal data from interception. Required for PCI DSS compliance.',
    reference: 'WooCommerce: SSL and HTTPS / PCI DSS Requirements',
  },
  {
    id: 'wc_https_ok',
    category: 'WooCommerce',
    severity: 'positive',
    weight: 0,
    title: 'WooCommerce store served over HTTPS',
    check: (d) => d.platform?.woocommerce?.detected && d.http?.https === true,
    finding: () => 'The WooCommerce store correctly uses HTTPS, encrypting all customer and payment data.',
    why: 'HTTPS is a PCI DSS requirement and essential for customer trust in an e-commerce store.',
    how_to_fix: 'No action required.',
    impact: 'Customer and payment data is protected in transit.',
    reference: 'WooCommerce: SSL and HTTPS',
  },
  {
    id: 'wc_no_hsts',
    category: 'WooCommerce',
    severity: 'warning',
    weight: 15,
    title: 'WooCommerce store missing HSTS header',
    check: (d) => {
      if (!d.platform?.woocommerce?.detected || !d.http?.https) return false;
      return !d.http?.security_headers?.hsts;
    },
    finding: () => 'The WooCommerce store is served over HTTPS but is missing the Strict-Transport-Security (HSTS) header.',
    why: 'Without HSTS, browsers can be tricked into downgrading to HTTP via SSL stripping attacks, exposing customer data even on an HTTPS store. HSTS instructs browsers to always use HTTPS, eliminating this attack vector.',
    how_to_fix: 'Add the HSTS header at the server level: Strict-Transport-Security: max-age=31536000; includeSubDomains. In Apache, add to .htaccess or server config. In Nginx, add to server block. This is also a PCI DSS requirement.',
    impact: 'Protects customers from SSL stripping attacks and brings the store into PCI DSS compliance for transport security.',
    reference: 'Sucuri WooCommerce Security Guide: https://sucuri.net/guides/woocommerce-security-guide/',
  },
  {
    id: 'wc_no_csp',
    category: 'WooCommerce',
    severity: 'warning',
    weight: 12,
    title: 'WooCommerce store missing Content Security Policy',
    check: (d) => d.platform?.woocommerce?.detected && !d.http?.security_headers?.csp,
    finding: () => 'The WooCommerce store has no Content-Security-Policy (CSP) header.',
    why: 'E-commerce sites are prime targets for JavaScript skimming attacks (Magecart-style). A CSP prevents injected scripts from running, protecting customer payment data from being stolen through malicious script injection.',
    how_to_fix: 'Implement a Content-Security-Policy header that restricts script sources to trusted domains. Start with a report-only mode to assess impact before enforcing. At minimum, restrict script-src to your own domain and known trusted CDNs.',
    impact: 'Blocks JavaScript skimming attacks that steal customer payment card data from checkout pages.',
    reference: 'Sucuri WooCommerce Security Guide: https://sucuri.net/guides/woocommerce-security-guide/',
  },
  {
    id: 'wc_payment_keys_exposed',
    category: 'WooCommerce',
    severity: 'critical',
    weight: 40,
    title: 'Payment processor API keys exposed in page source',
    check: (d) => d.platform?.woocommerce?.detected && (d.security?.payment_keys_exposed?.length || 0) > 0,
    finding: (d) => `Payment processor API key(s) found in HTML/JS source: ${(d.security?.payment_keys_exposed || []).join(', ')}.`,
    why: 'API keys embedded in client-side HTML or JavaScript are visible to anyone who views source. A Stripe secret key (sk_live_) grants full account access — create charges, issue refunds, access customer data. Even a publishable key (pk_live_) confirms the payment stack and can be used in certain fraud patterns. This is a critical PCI DSS violation.',
    how_to_fix: 'Remove all API keys from client-side code immediately. Secret keys must never appear in HTML, JavaScript, or any publicly accessible file. Use server-side payment intent creation. Regenerate any exposed secret keys in your Stripe/PayPal dashboard immediately as they must be considered compromised.',
    impact: 'Prevents payment account takeover, fraudulent charges, and customer data theft.',
    reference: 'Stripe Security Best Practices: https://stripe.com/docs/security',
  },
  {
    id: 'wc_robots_missing_protections',
    category: 'WooCommerce',
    severity: 'info',
    weight: 5,
    title: 'robots.txt missing WooCommerce sensitive path protections',
    check: (d) => {
      if (!d.platform?.woocommerce?.detected) return false;
      const content = (d.seo?.robots_txt?.content || '').toLowerCase();
      if (!content) return false;
      const missing = ['/checkout/', '/cart/', '/my-account/'].filter(p => !content.includes(p));
      return missing.length > 0;
    },
    finding: (d) => {
      const content = (d.seo?.robots_txt?.content || '').toLowerCase();
      const missing = ['/checkout/', '/cart/', '/my-account/'].filter(p => !content.includes(p));
      return `robots.txt is missing Disallow rules for: ${missing.join(', ')}. These pages may be indexed by search engines.`;
    },
    why: 'WooCommerce checkout, cart, and account pages should not be indexed by search engines. Without Disallow rules, search bots may crawl and index order confirmation URLs (which contain order keys), cart contents, and account pages — potentially exposing customer data in search results or web archives.',
    how_to_fix: 'Add these entries to your robots.txt file:\nDisallow: /checkout/\nDisallow: /cart/\nDisallow: /my-account/\nDisallow: /wp-admin/\nDisallow: /wp-login.php',
    impact: 'Prevents sensitive WooCommerce pages from being indexed, reducing data exposure risk.',
    reference: 'WooCommerce Security Best Practices: https://woocommerce.com/document/ssl-and-https/',
  },
  {
    id: 'wc_store_api_public',
    category: 'WooCommerce',
    severity: 'critical',
    weight: 30,
    title: 'WooCommerce Store API accessible without authentication',
    check: (d) => d.platform?.woocommerce?.detected && d.security?.wc_security?.store_api_public === true,
    finding: () => 'The WooCommerce Store REST API (/wp-json/wc/store/v1/products) is accessible without authentication, potentially exposing customer data and order information.',
    why: 'The WooCommerce Store API was affected by CVE-2023-7320 and CVE-2025-15033 which allowed unauthenticated access to customer PII and order data. Even without a specific CVE, public access to the Store API can expose product pricing, stock levels, and in misconfigured installations, customer data to unauthenticated attackers.',
    how_to_fix: 'Update WooCommerce to the latest version immediately. Review the REST API permissions in WooCommerce → Settings → Advanced → REST API. If the Store API does not need to be public, restrict access via server rules or a firewall plugin. Ensure the WooCommerce version is not affected by any known Store API CVEs.',
    impact: 'Protects customer PII and order data from unauthenticated access. Required for PCI DSS compliance.',
    reference: 'NVD CVE-2023-7320: https://nvd.nist.gov/vuln/detail/CVE-2023-7320',
  },
];

module.exports = [...WP_RULES, ...WC_RULES];
