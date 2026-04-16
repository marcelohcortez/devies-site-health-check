import type { SiteResult } from '../src/types';

export const MOCK_RESULT: SiteResult = {
  url: 'https://example.com',
  overall_score: 72,
  summary: 'Your site has room for improvement in Security and Performance.',
  platform: 'html',
  category_scores: {
    SEO: 85,
    Security: 60,
    Performance: 75,
    Accessibility: 70,
    HTML_Structure: 80,
  },
  findings: [
    {
      category:   'Security',
      severity:   'critical',
      title:      'Missing HSTS header',
      finding:    'No Strict-Transport-Security header was found.',
      how_to_fix: 'Add Strict-Transport-Security: max-age=31536000; includeSubDomains',
    },
    {
      category:   'Security',
      severity:   'warning',
      title:      'Missing Content Security Policy',
      finding:    'No Content-Security-Policy header was found.',
      how_to_fix: 'Add a Content-Security-Policy header.',
    },
    {
      category:   'Security',
      severity:   'info',
      title:      'Missing Permissions Policy',
      finding:    'No Permissions-Policy header was found.',
    },
    {
      category: 'Security',
      severity: 'positive',
      title:    'HTTPS enabled',
      finding:  'Site is served over HTTPS.',
    },
  ],
};

export const MOCK_RESULT_2: SiteResult = {
  url: 'https://another.com',
  overall_score: 55,
  summary: 'Several critical issues need immediate attention.',
  platform: 'wordpress',
  category_scores: {
    SEO: 60,
    Security: 40,
    Performance: 55,
    Accessibility: 65,
    HTML_Structure: 70,
  },
  findings: [
    {
      category:   'Security',
      severity:   'critical',
      title:      'No HTTPS',
      finding:    'Site is not served over HTTPS.',
      how_to_fix: 'Install an SSL certificate.',
    },
  ],
};
