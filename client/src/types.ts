export interface Finding {
  severity: 'critical' | 'warning' | 'info' | 'positive';
  title: string;
  finding?: string;
  description?: string;
  how_to_fix?: string;
}

export interface SiteResult {
  url: string;
  overall_score: number;
  summary: string;
  platform: string;
  category_scores: Record<string, number>;
  findings: Finding[];
}

export interface AuditResults {
  results: SiteResult[];
  name: string;
}

export interface FormData {
  name: string;
  email: string;
  urls: string[];
  consent: true;
}
