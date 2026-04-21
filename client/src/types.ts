export interface Finding {
  category:    string;
  severity:    'critical' | 'warning' | 'info' | 'positive';
  title:       string;
  finding?:    string;
  description?: string;
  how_to_fix?: string;
  /** URL of the specific page where this finding was detected. Null for multipage aggregate rules (paths are in the finding text). */
  page_url?:   string | null;
}

export interface SiteResult {
  url: string;
  overall_score: number;
  summary: string;
  platform: string;
  category_scores: Record<string, number>;
  findings: Finding[];
  pages_crawled?: number;
}

export interface SiteResultError {
  url: string | null;
  error: string;
}

export type SiteResultItem = SiteResult | SiteResultError;

export function isSiteError(r: SiteResultItem): r is SiteResultError {
  return 'error' in r;
}

export interface AuditResults {
  results: SiteResultItem[];
  name: string;
}

export interface FormData {
  name: string;
  email: string;
  urls: string[];
  consent: true;
}
