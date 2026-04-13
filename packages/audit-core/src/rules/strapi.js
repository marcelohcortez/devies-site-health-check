'use strict';
/**
 * Strapi CMS Rules
 *
 * Sources / guidelines:
 *   - Strapi Security Checklist: https://strapi.io/blog/strapi-security-checklist
 *   - Strapi API Security Best Practices: https://strapi.io/blog/best-practices-of-api-security-in-strapi
 *   - Strapi Documentation: https://docs.strapi.io/dev-docs/configurations/
 *   - Strapi Best Practices (Bratislava): https://bratislava.github.io/strapi/best-practices
 *   - Strapi CORS Configuration Guide: https://strapi.io/blog/what-is-cors-configuration-guide
 *   - CVE-2024-56143 (lookup private field exposure)
 *   - OWASP API Security Top 10
 *
 * TWO CHECK MODES:
 *   HTTP mode: Rules check `d.platform.strapi.probes.*` — fires when Strapi is detected
 *              from a live URL audit (X-Powered-By header, API response shape, etc.)
 *   File mode: Rules check `d.strapi.*` — fires during file-based audits (file-auditor.js)
 *              when strapiAnalysis data is present in the scrapedData.
 *
 * All checks are null-safe: they return false if data is absent.
 */

module.exports = [

  // ══════════════════════════════════════════════════════════════════════════
  // HTTP-DETECTABLE RULES (URL-based audit of a live Strapi instance)
  // ══════════════════════════════════════════════════════════════════════════

  // ── Critical (HTTP) ────────────────────────────────────────────────────────

  {
    id: 'strapi_cors_reflection',
    category: 'Strapi',
    severity: 'critical',
    weight: 35,
    title: 'CORS Origin reflection vulnerability',
    check: (d) => {
      const p = d.platform?.strapi?.probes;
      if (!p) return false;
      return p.cors_reflects_origin === true && p.cors_credentials === true;
    },
    finding: () => 'The Strapi API reflects the caller\'s Origin header in Access-Control-Allow-Origin while also allowing credentials. Any website can make authenticated cross-origin requests.',
    why: 'This is a CORS origin reflection vulnerability (pre-Strapi 5.20.0). When Access-Control-Allow-Origin reflects the caller\'s origin AND Access-Control-Allow-Credentials is true, any malicious website can make authenticated API requests on behalf of logged-in users, stealing data or performing actions.',
    how_to_fix: 'Upgrade Strapi to 5.20.0 or later, which includes the security fix. Additionally, configure an explicit origin whitelist in config/middlewares.js: { name: \'strapi::cors\', config: { origin: [\'https://your-frontend.com\'] } }',
    impact: 'Prevents malicious websites from making authenticated requests to the Strapi API on behalf of logged-in users.',
    reference: 'Strapi CORS Security Fix (v5.20.0): https://strapi.io/blog/what-is-cors-configuration-guide',
  },

  {
    id: 'strapi_graphql_introspection',
    category: 'Strapi',
    severity: 'critical',
    weight: 20,
    title: 'GraphQL introspection enabled in production',
    check: (d) => {
      const p = d.platform?.strapi?.probes;
      if (!p) return false;
      return p.graphql_introspection === true;
    },
    finding: () => 'The GraphQL endpoint at /graphql has introspection enabled, exposing the complete API schema to unauthenticated requests.',
    why: 'GraphQL introspection returns a complete map of every query, mutation, type, and field in the API. In production, this gives attackers a full blueprint of the data model and API capabilities, significantly lowering the barrier to finding and exploiting vulnerabilities.',
    how_to_fix: 'Disable GraphQL introspection in production. In config/plugins.js: { graphql: { config: { introspection: false, playgroundAlways: false } } }. Use an environment variable to enable it only in development.',
    impact: 'Attackers cannot enumerate the full API schema, making exploitation significantly harder.',
    reference: 'Strapi GraphQL Plugin: https://docs.strapi.io/cms/plugins/graphql',
  },

  {
    id: 'strapi_api_public_no_auth',
    category: 'Strapi',
    severity: 'critical',
    weight: 25,
    title: 'Strapi API accessible without authentication',
    check: (d) => {
      const p = d.platform?.strapi?.probes;
      if (!p) return false;
      return p.api_public === true;
    },
    finding: () => 'The Strapi REST API at /api returns data without requiring any authentication.',
    why: 'By default, Strapi grants the "Public" role read access to all content types. This means any content marked as published is accessible to unauthenticated users and bots. This may expose internal content, user data, or business information to the public internet.',
    how_to_fix: 'In the Strapi admin panel, go to Settings → Users & Permissions Plugin → Roles → Public. Remove find/findOne permissions from all content types that should not be public. Only explicitly grant public access to content that is intentionally public-facing.',
    impact: 'Sensitive content is protected behind authentication, preventing unauthorised data access.',
    reference: 'Strapi API Security: https://strapi.io/blog/best-practices-of-api-security-in-strapi',
  },

  // ── Warnings (HTTP) ───────────────────────────────────────────────────────

  {
    id: 'strapi_admin_panel_exposed',
    category: 'Strapi',
    severity: 'warning',
    weight: 15,
    title: 'Strapi admin panel at default /admin path',
    check: (d) => {
      const p = d.platform?.strapi?.probes;
      if (!p) return false;
      return p.admin_accessible === true;
    },
    finding: () => 'The Strapi admin panel is accessible at the default /admin URL without any additional access restriction.',
    why: 'Automated scanners and bots continuously probe /admin for known CMS admin panels. A publicly accessible admin panel is subject to high-volume automated credential stuffing and brute-force attacks. Even if login is required, the reduced security barrier increases risk.',
    how_to_fix: 'Restrict access to /admin by IP address at the server/proxy level (Nginx, Cloudflare Access, etc.). Optionally, change the admin URL path in config/admin.js. Enable 2FA for all admin accounts in Strapi settings.',
    impact: 'Significantly reduces the attack surface for admin credential attacks.',
    reference: 'Strapi Security Checklist: https://strapi.io/blog/strapi-security-checklist',
  },

  {
    id: 'strapi_graphql_accessible',
    category: 'Strapi',
    severity: 'warning',
    weight: 10,
    title: 'GraphQL endpoint exposed at /graphql',
    check: (d) => {
      const p = d.platform?.strapi?.probes;
      if (!p) return false;
      // Only flag if accessible but not introspection (introspection is already critical)
      return p.graphql_accessible === true && !p.graphql_introspection;
    },
    finding: () => 'A GraphQL endpoint is accessible at /graphql. While introspection is disabled, the endpoint is publicly reachable.',
    why: 'Even with introspection disabled, an accessible GraphQL endpoint can be probed through query fuzzing. If any queries are accessible to unauthenticated users, attackers can retrieve data. The endpoint should be restricted to authenticated users or specific IP ranges if not intended for public use.',
    how_to_fix: 'Ensure all GraphQL queries require authentication unless intentionally public. In config/plugins.js, configure graphql with appropriate auth requirements. Consider restricting /graphql access at the server level if it is only used internally.',
    impact: 'Reduces the attack surface for unauthenticated GraphQL abuse.',
    reference: 'Strapi GraphQL Plugin: https://docs.strapi.io/cms/plugins/graphql',
  },

  {
    id: 'strapi_cors_wildcard_http',
    category: 'Strapi',
    severity: 'critical',
    weight: 20,
    title: 'CORS allows all origins (*) in HTTP response',
    check: (d) => {
      const p = d.platform?.strapi?.probes;
      if (!p) return false;
      return p.cors_wildcard === true;
    },
    finding: () => 'The Strapi API responds with Access-Control-Allow-Origin: * allowing any domain to make cross-origin requests.',
    why: 'Wildcard CORS means any website can make cross-origin requests to the API. While browsers will block credentials with wildcards, this still allows unauthenticated data retrieval from any origin. Combined with weak API permissions, this exposes all public content to any webpage.',
    how_to_fix: 'Remove the wildcard CORS configuration. In config/middlewares.js, set a specific origin list: { name: \'strapi::cors\', config: { origin: [\'https://your-frontend.com\'] } }',
    impact: 'Only authorised frontend domains can make cross-origin requests to the API.',
    reference: 'Strapi CORS Configuration: https://strapi.io/blog/what-is-cors-configuration-guide',
  },

  // ── Positive (HTTP) ───────────────────────────────────────────────────────

  {
    id: 'strapi_graphql_introspection_disabled',
    category: 'Strapi',
    severity: 'positive',
    weight: 0,
    title: 'GraphQL introspection is disabled',
    check: (d) => {
      const p = d.platform?.strapi?.probes;
      if (!p) return false;
      return p.graphql_accessible === true && p.graphql_introspection === false;
    },
    finding: () => 'GraphQL introspection is disabled on the /graphql endpoint, preventing schema enumeration.',
    why: 'Disabled introspection prevents attackers from mapping the full API schema.',
    how_to_fix: 'No action required.',
    impact: 'API schema is not exposed to unauthenticated requests.',
    reference: 'Strapi GraphQL Plugin: https://docs.strapi.io/cms/plugins/graphql',
  },

  // ══════════════════════════════════════════════════════════════════════════
  // FILE-BASED RULES (file-auditor.js audit of Strapi source files)
  // ══════════════════════════════════════════════════════════════════════════

  // ── Critical ─────────────────────────────────────────────────────────────

  {
    id: 'strapi_jwt_secret_missing',
    category: 'Strapi',
    severity: 'critical',
    weight: 30,
    title: 'JWT_SECRET not configured in .env',
    check: (d) => {
      if (!d.strapi) return false;
      return d.strapi.has_env_file && !d.strapi.jwt_secret_in_env;
    },
    finding: () => 'The JWT_SECRET variable is missing from the .env file. Strapi uses this to sign user session tokens.',
    why: 'Without a proper JWT_SECRET, Strapi may fall back to an insecure default, meaning any session token can be forged. An attacker with knowledge of the default secret can authenticate as any user, including administrators. This is a critical authentication vulnerability.',
    how_to_fix: 'Add JWT_SECRET to your .env file with a cryptographically random value of at least 32 characters. Generate with: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'base64\'))"',
    impact: 'All user sessions are protected by a unique, unpredictable secret that cannot be forged by attackers.',
    reference: 'Strapi Configuration — Environment variables: https://docs.strapi.io/dev-docs/configurations/environment',
  },

  {
    id: 'strapi_admin_jwt_missing',
    category: 'Strapi',
    severity: 'critical',
    weight: 30,
    title: 'ADMIN_JWT_SECRET not configured in .env',
    check: (d) => {
      if (!d.strapi) return false;
      return d.strapi.has_env_file && !d.strapi.admin_jwt_in_env;
    },
    finding: () => 'The ADMIN_JWT_SECRET variable is missing from the .env file. This secret signs admin panel session tokens.',
    why: 'ADMIN_JWT_SECRET is separate from JWT_SECRET because admin panel tokens carry elevated privileges. If missing or using a default value, attackers can forge admin tokens and gain full control over the Strapi admin panel, all content, and settings.',
    how_to_fix: 'Add ADMIN_JWT_SECRET to your .env file with a unique cryptographically random value. It must be different from JWT_SECRET. Generate with: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'base64\'))"',
    impact: 'Admin panel sessions cannot be forged, protecting full administrative access to the Strapi instance.',
    reference: 'Strapi Security: Admin JWT Secret — https://docs.strapi.io/dev-docs/configurations/admin-panel',
  },

  {
    id: 'strapi_app_keys_missing',
    category: 'Strapi',
    severity: 'critical',
    weight: 25,
    title: 'APP_KEYS not configured in .env',
    check: (d) => {
      if (!d.strapi) return false;
      return d.strapi.has_env_file && !d.strapi.app_keys_in_env;
    },
    finding: () => 'The APP_KEYS variable is missing from the .env file. Strapi uses these keys for session encryption and cookie signing.',
    why: 'APP_KEYS are used to encrypt and sign session cookies and CSRF tokens. Without proper unique keys, an attacker can forge cookies and bypass CSRF protection. Using default keys is equivalent to having no security for session management.',
    how_to_fix: 'Add APP_KEYS to your .env file as a comma-separated list of at least 2 unique base64 random strings. Generate each with: node -e "console.log(require(\'crypto\').randomBytes(16).toString(\'base64\'))"',
    impact: 'Session cookies and CSRF tokens are properly encrypted and cannot be forged.',
    reference: 'Strapi Configuration — Server config: https://docs.strapi.io/dev-docs/configurations/server',
  },

  {
    id: 'strapi_api_token_salt_missing',
    category: 'Strapi',
    severity: 'critical',
    weight: 20,
    title: 'API_TOKEN_SALT not configured in .env',
    check: (d) => {
      if (!d.strapi) return false;
      return d.strapi.has_env_file && !d.strapi.api_token_salt_in_env;
    },
    finding: () => 'The API_TOKEN_SALT variable is missing from the .env file. Strapi uses this to hash API tokens.',
    why: 'API tokens are stored as hashes using this salt. Without a unique salt, API tokens generated by your instance may be predictable or collide with tokens from other Strapi installations using the same default. This can enable API token forgery.',
    how_to_fix: 'Add API_TOKEN_SALT to your .env file with a unique random value. Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"',
    impact: 'API tokens are hashed with a unique salt, making them resistant to forgery and cross-installation token collisions.',
    reference: 'Strapi Configuration — Environment variables: https://docs.strapi.io/dev-docs/configurations/environment',
  },

  {
    id: 'strapi_env_not_in_gitignore',
    category: 'Strapi',
    severity: 'critical',
    weight: 35,
    title: '.env file not excluded from git',
    check: (d) => {
      if (!d.strapi) return false;
      return d.strapi.has_env_file && !d.strapi.gitignore_includes_env;
    },
    finding: () => 'The .env file exists but is not listed in .gitignore. This means secrets may be committed to version control.',
    why: 'If .env is accidentally committed to git, all secrets (JWT secrets, database credentials, API keys) are permanently exposed — even if deleted later, the secrets remain in git history. This is one of the most common and severe security mistakes in web development.',
    how_to_fix: 'Immediately add .env to .gitignore: echo ".env" >> .gitignore. If .env was already committed, rotate ALL secrets immediately and remove it from git history using git filter-branch or BFG Repo Cleaner.',
    impact: 'Prevents accidental secret leakage to version control systems, protecting all credentials from exposure.',
    reference: 'OWASP Secure Coding: Credentials Management — https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html',
  },

  {
    id: 'strapi_no_env_file',
    category: 'Strapi',
    severity: 'critical',
    weight: 25,
    title: 'No .env file found',
    check: (d) => {
      if (!d.strapi) return false;
      return !d.strapi.has_env_file;
    },
    finding: () => 'No .env file was found. Strapi requires environment variables for security-critical configuration.',
    why: 'Without a .env file, Strapi may use insecure default values for JWT secrets, app keys, and database configuration. Default values are publicly known and make authentication trivially bypassable by any attacker who knows the defaults.',
    how_to_fix: 'Create a .env file at the project root based on .env.example (if present). At minimum, configure: JWT_SECRET, ADMIN_JWT_SECRET, APP_KEYS, API_TOKEN_SALT, and DATABASE_URL.',
    impact: 'Strapi is configured with unique, secure secrets instead of predictable defaults.',
    reference: 'Strapi Configuration — Environment variables: https://docs.strapi.io/dev-docs/configurations/environment',
  },

  {
    id: 'strapi_cors_wildcard',
    category: 'Strapi',
    severity: 'critical',
    weight: 20,
    title: 'CORS configured with wildcard origin (*)',
    check: (d) => {
      if (!d.strapi) return false;
      return d.strapi.cors_wildcard === true;
    },
    finding: () => 'The Strapi middleware configuration uses CORS with a wildcard origin (*), allowing any domain to make cross-origin requests.',
    why: 'Wildcard CORS means any website on the internet can make authenticated API requests to this Strapi instance from a user\'s browser. This enables cross-site request forgery attacks and bypasses the same-origin security model, exposing all content and user data to malicious sites.',
    how_to_fix: 'In config/middlewares.js, replace origin: \'*\' with a specific list of allowed origins: origin: [\'https://your-frontend.com\']. Never use wildcard CORS in production.',
    impact: 'Only trusted frontend domains can make cross-origin requests to the Strapi API, preventing CSRF and data theft attacks.',
    reference: 'Strapi Middlewares: CORS — https://docs.strapi.io/dev-docs/configurations/middlewares',
  },

  // ── Warnings ─────────────────────────────────────────────────────────────

  {
    id: 'strapi_sqlite_production',
    category: 'Strapi',
    severity: 'warning',
    weight: 20,
    title: 'SQLite database — not suitable for production',
    check: (d) => {
      if (!d.strapi) return false;
      return d.strapi.uses_sqlite === true;
    },
    finding: () => 'The Strapi instance is configured to use SQLite. SQLite is only suitable for local development.',
    why: 'SQLite does not support concurrent writes, has no user access controls, and stores all data in a single file that is trivially copied if file system access is obtained. For any production use with multiple simultaneous users or sensitive data, SQLite creates data corruption risks and a single point of data compromise.',
    how_to_fix: 'Migrate to PostgreSQL or MySQL/MariaDB for production. Update config/database.js to use your production database connection. PostgreSQL is the recommended choice for Strapi production deployments.',
    impact: 'Production data is stored in a robust database that supports concurrent access, access controls, and proper backups.',
    reference: 'Strapi Configuration — Database: https://docs.strapi.io/dev-docs/configurations/database',
  },

  {
    id: 'strapi_no_rate_limiting',
    category: 'Strapi',
    severity: 'warning',
    weight: 15,
    title: 'Rate limiting not configured',
    check: (d) => {
      if (!d.strapi) return false;
      return d.strapi.cors_configured !== undefined && !d.strapi.rate_limit_enabled;
    },
    finding: () => 'No rate limiting middleware was detected in the Strapi configuration.',
    why: 'Without rate limiting, the Strapi API is vulnerable to brute-force login attacks, content scraping, and denial-of-service. Attackers can make unlimited requests to try passwords, enumerate content, or overwhelm the server.',
    how_to_fix: 'Enable the built-in koa-ratelimit middleware in config/middlewares.js. Configure limits appropriate for your expected traffic (e.g., 100 requests per minute per IP). Consider stricter limits for the /api/auth/ endpoint.',
    impact: 'Protects against brute-force attacks and abuse of the API, maintaining service availability.',
    reference: 'Strapi Middlewares: Rate Limiting — https://docs.strapi.io/dev-docs/configurations/middlewares',
  },

  {
    id: 'strapi_no_cors_config',
    category: 'Strapi',
    severity: 'warning',
    weight: 15,
    title: 'CORS not explicitly configured',
    check: (d) => {
      if (!d.strapi) return false;
      // Flag if middlewares config exists but no CORS, or if no middleware config at all
      return d.strapi.has_config_dir && !d.strapi.cors_configured && !d.strapi.cors_wildcard;
    },
    finding: () => 'No CORS configuration was found in the Strapi middleware config.',
    why: 'Without explicit CORS configuration, Strapi may use default settings that either allow too many or too few origins. Relying on defaults is a security risk because the defaults may change between Strapi versions, and the current behaviour may not match your expectations.',
    how_to_fix: 'Add an explicit CORS configuration in config/middlewares.js specifying the allowed origins for your frontend: { name: \'strapi::cors\', config: { origin: [\'https://your-frontend.com\'], credentials: true } }',
    impact: 'Cross-origin access is explicitly controlled, matching your intended security policy.',
    reference: 'Strapi Middlewares: CORS — https://docs.strapi.io/dev-docs/configurations/middlewares',
  },

  {
    id: 'strapi_doc_plugin_in_production',
    category: 'Strapi',
    severity: 'warning',
    weight: 10,
    title: 'Documentation plugin (Swagger) installed',
    check: (d) => {
      if (!d.strapi) return false;
      return d.strapi.doc_plugin_installed === true;
    },
    finding: () => 'The @strapi/plugin-documentation plugin is installed, which exposes a Swagger/OpenAPI interface at /documentation.',
    why: 'The documentation plugin generates and exposes a complete API schema at /documentation. In production, this gives attackers a full map of every API endpoint, content type, and parameter, making it significantly easier to find and exploit vulnerabilities.',
    how_to_fix: 'If the documentation plugin is needed for development, ensure it is disabled or access-restricted in production environments. Use environment variables to conditionally enable it only in development: restrict access to /documentation to authorised IPs, or disable the plugin entirely in production config.',
    impact: 'Reduces the information available to attackers about the API structure.',
    reference: 'Strapi Security Best Practices: https://bratislava.github.io/strapi/best-practices',
  },

  {
    id: 'strapi_admin_url_default',
    category: 'Strapi',
    severity: 'warning',
    weight: 10,
    title: 'Admin panel at default /admin URL',
    check: (d) => {
      if (!d.strapi) return false;
      return d.strapi.has_config_dir && !d.strapi.admin_url_customised;
    },
    finding: () => 'The Strapi admin panel appears to be at the default /admin URL.',
    why: 'Automated bots and attackers routinely probe /admin for known CMS admin panels. Keeping the default URL increases the volume of automated attacks. While security through obscurity is not sufficient alone, changing the admin URL reduces noise and the risk of automated exploitation of zero-day vulnerabilities.',
    how_to_fix: 'In config/admin.js, set a custom admin URL: module.exports = ({ env }) => ({ url: \'/your-custom-admin-path\' }). Combine with IP allowlisting for stronger protection.',
    impact: 'Reduces automated attack volume against the admin panel.',
    reference: 'Strapi Configuration — Admin panel: https://docs.strapi.io/dev-docs/configurations/admin-panel',
  },

  {
    id: 'strapi_no_csp',
    category: 'Strapi',
    severity: 'warning',
    weight: 10,
    title: 'Content Security Policy not configured',
    check: (d) => {
      if (!d.strapi) return false;
      return d.strapi.cors_configured !== undefined && !d.strapi.csp_configured;
    },
    finding: () => 'No Content-Security-Policy configuration was found in the Strapi middleware setup.',
    why: 'Without CSP headers, the Strapi admin panel is vulnerable to cross-site scripting (XSS) attacks. If an attacker can inject a script via content or a plugin vulnerability, they can steal admin credentials or take over the admin session.',
    how_to_fix: 'Configure the strapi::security middleware in config/middlewares.js to set appropriate CSP headers. The built-in security middleware wraps helmet.js and can be configured with contentSecurityPolicy options.',
    impact: 'Prevents XSS attacks in the admin panel by restricting which scripts can be executed.',
    reference: 'Strapi Middlewares: Security headers — https://docs.strapi.io/dev-docs/configurations/middlewares',
  },

  // ── Info ─────────────────────────────────────────────────────────────────

  {
    id: 'strapi_no_env_example',
    category: 'Strapi',
    severity: 'info',
    weight: 5,
    title: 'No .env.example file found',
    check: (d) => {
      if (!d.strapi) return false;
      return !d.strapi.has_env_example;
    },
    finding: () => 'No .env.example file was found in the project root.',
    why: '.env.example documents all required environment variables without exposing actual secret values. Without it, new developers or deployment environments may miss configuring critical security variables.',
    how_to_fix: 'Create a .env.example file listing all required environment variables with placeholder values (e.g., JWT_SECRET=REPLACE_WITH_RANDOM_SECRET). Commit this file to version control.',
    impact: 'New developers and deployment pipelines know exactly which variables to configure, reducing the risk of missing security-critical configuration.',
    reference: 'Strapi Configuration — Environment variables: https://docs.strapi.io/dev-docs/configurations/environment',
  },

  {
    id: 'strapi_no_config_dir',
    category: 'Strapi',
    severity: 'info',
    weight: 5,
    title: 'Strapi config/ directory missing or empty',
    check: (d) => {
      if (!d.strapi) return false;
      return !d.strapi.has_config_dir;
    },
    finding: () => 'No config/ directory was found in the Strapi project.',
    why: 'The config/ directory contains all Strapi configuration (middlewares, database, server, plugins, admin). Its absence suggests configuration may be relying entirely on defaults, which may not be secure or appropriate for the deployment environment.',
    how_to_fix: 'Create the config/ directory and add appropriate configuration files: config/middlewares.js (CORS, security, rate limiting), config/database.js, config/server.js, and config/admin.js.',
    impact: 'Explicit configuration ensures security settings are intentional and not reliant on defaults that may change between versions.',
    reference: 'Strapi Configuration Overview: https://docs.strapi.io/dev-docs/configurations/',
  },

  {
    id: 'strapi_no_typescript',
    category: 'Strapi',
    severity: 'info',
    weight: 3,
    title: 'Project uses JavaScript instead of TypeScript',
    check: (d) => {
      if (!d.strapi) return false;
      return !d.strapi.has_typescript;
    },
    finding: () => 'The Strapi project uses JavaScript rather than TypeScript.',
    why: 'TypeScript catches type errors at compile time, reducing bugs in content type definitions, controller logic, and API customisations. Strapi officially supports TypeScript and recommends it for new projects.',
    how_to_fix: 'Consider migrating to TypeScript for new Strapi projects. The official Strapi CLI scaffolds TypeScript projects by default. For existing projects, gradual migration is possible.',
    impact: 'Type safety reduces bugs in custom controllers, policies, and content type configurations.',
    reference: 'Strapi TypeScript Support: https://docs.strapi.io/dev-docs/typescript',
  },

  // ── Positive ─────────────────────────────────────────────────────────────

  {
    id: 'strapi_all_secrets_configured',
    category: 'Strapi',
    severity: 'positive',
    weight: 0,
    title: 'All required Strapi secrets configured',
    check: (d) => {
      if (!d.strapi) return false;
      return d.strapi.all_secrets_in_env === true;
    },
    finding: () => 'All required secrets (JWT_SECRET, ADMIN_JWT_SECRET, APP_KEYS, API_TOKEN_SALT) are configured in the .env file.',
    why: 'Properly configured secrets ensure authentication tokens cannot be forged.',
    how_to_fix: 'No action required. Ensure secrets are rotated regularly and are unique per environment.',
    impact: 'Authentication is secured with unique, properly configured cryptographic secrets.',
    reference: 'Strapi Configuration — Environment variables: https://docs.strapi.io/dev-docs/configurations/environment',
  },

  {
    id: 'strapi_env_in_gitignore',
    category: 'Strapi',
    severity: 'positive',
    weight: 0,
    title: '.env correctly excluded from git',
    check: (d) => {
      if (!d.strapi) return false;
      return d.strapi.has_env_file && d.strapi.gitignore_includes_env;
    },
    finding: () => 'The .env file is listed in .gitignore, preventing secrets from being accidentally committed.',
    why: 'Excluding .env from git prevents secret leakage to version control systems.',
    how_to_fix: 'No action required.',
    impact: 'Secrets cannot be accidentally committed to version control.',
    reference: 'OWASP Secrets Management: https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html',
  },

  {
    id: 'strapi_production_database',
    category: 'Strapi',
    severity: 'positive',
    weight: 0,
    title: 'Production-ready database configured',
    check: (d) => {
      if (!d.strapi) return false;
      return d.strapi.uses_sqlite === false;
    },
    finding: () => 'The Strapi instance is not using SQLite — a production-ready database (PostgreSQL or MySQL) appears to be configured.',
    why: 'A production database supports concurrent access, access controls, and proper backup procedures.',
    how_to_fix: 'No action required.',
    impact: 'Data is stored reliably in a database designed for production workloads.',
    reference: 'Strapi Configuration — Database: https://docs.strapi.io/dev-docs/configurations/database',
  },

  {
    id: 'strapi_cors_restricted',
    category: 'Strapi',
    severity: 'positive',
    weight: 0,
    title: 'CORS configured with restricted origins',
    check: (d) => {
      if (!d.strapi) return false;
      return d.strapi.cors_configured && !d.strapi.cors_wildcard;
    },
    finding: () => 'CORS is configured with specific origin restrictions, not a wildcard.',
    why: 'Restricted CORS origins prevent unauthorised websites from making cross-origin requests to the API.',
    how_to_fix: 'No action required.',
    impact: 'Only trusted domains can make cross-origin requests to the Strapi API.',
    reference: 'Strapi Middlewares: CORS — https://docs.strapi.io/dev-docs/configurations/middlewares',
  },
];
