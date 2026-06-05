import { useState } from 'react';
import type { AuditResults, Finding, SiteResult, SiteResultItem } from '../types';
import { isSiteError } from '../types';
import DeviesHeader from './DeviesHeader';

// ── Helpers ───────────────────────────────────────────────────────────────────

type Grade = { letter: string; cls: string };

function gradeOf(score: number): Grade {
  if (score >= 90) return { letter: 'A', cls: 'grade-a' };
  if (score >= 80) return { letter: 'B', cls: 'grade-b' };
  if (score >= 70) return { letter: 'C', cls: 'grade-c' };
  if (score >= 60) return { letter: 'D', cls: 'grade-d' };
  return              { letter: 'F', cls: 'grade-f' };
}

function scoreColor(score: number): string {
  if (score >= 80) return '#388e3c';
  if (score >= 60) return '#f57c00';
  return '#c62828';
}

function hostname(url: string): string {
  try { return new URL(url).hostname; }
  catch { return url; }
}

function categoryLabel(key: string): string {
  const labels: Record<string, string> = {
    SEO:            'SEO',
    Security:       'Security',
    Performance:    'Performance',
    Accessibility:  'Accessibility',
    HTML_Structure: 'HTML Structure',
    AI_Readiness:   'AI Readiness',
    WordPress:      'WordPress',
    WooCommerce:    'WooCommerce',
    Strapi:         'Strapi',
  };
  return labels[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ── KPI Card 1: Overall Score donut ──────────────────────────────────────────

function ScoreCard({ score }: { score: number }) {
  const R    = 50;
  const circ = 2 * Math.PI * R;
  const fill = (score / 100) * circ;
  const color = scoreColor(score);

  let badgeLabel: string;
  let helperText: string;
  let helperBorder: string;
  let helperBg: string;

  if (score >= 80) {
    badgeLabel  = 'PASSED';
    helperText  = 'Good results — some improvements still possible';
    helperBorder = '#388e3c';
    helperBg    = '#f0fdf4';
  } else if (score >= 60) {
    badgeLabel  = 'NEEDS WORK';
    helperText  = 'Improvements needed to reach optimal performance across all areas';
    helperBorder = '#f57c00';
    helperBg    = '#fff8f0';
  } else {
    badgeLabel  = 'FAILED';
    helperText  = 'Score indicates significant quality issues across multiple areas';
    helperBorder = '#c62828';
    helperBg    = '#fff5f5';
  }

  return (
    <div className="kpi-card">
      <p className="kpi-lbl">OVERALL SCORE</p>
      <div className="kpi-score-row">
        <div className="kpi-donut-wrap">
          <svg className="kpi-donut-svg" width="120" height="120" viewBox="0 0 120 120" aria-hidden="true">
            <circle cx="60" cy="60" r={R} fill="none" stroke="#ececec" strokeWidth="8" />
            <circle
              cx="60" cy="60" r={R}
              fill="none" stroke={color} strokeWidth="8"
              strokeDasharray={`${fill.toFixed(2)} ${(circ - fill).toFixed(2)}`}
              strokeLinecap="butt"
              style={{ transition: 'stroke-dasharray 1.6s cubic-bezier(.4,0,.2,1)' }}
            />
          </svg>
          <div className="kpi-donut-inner">
            <span className="kpi-score-num">{score}</span>
            <span className="kpi-score-denom">/100</span>
          </div>
        </div>
        <div className="kpi-score-meta">
          <span className="conf-badge" style={{ background: color }}>{badgeLabel}</span>
          <p className="kpi-helper" style={{ borderLeftColor: helperBorder, background: helperBg }}>
            {helperText}
          </p>
        </div>
      </div>
      <p className="kpi-score-note">
        Score based on all automated checks across topics.{' '}
        <strong>0</strong> = fully failing · <strong>100</strong> = all criteria pass.
      </p>
    </div>
  );
}

// ── KPI Card 2: Compliance / Quality Risk ─────────────────────────────────────

function RiskCard({ score, criticalCount, totalIssues }: {
  score: number;
  criticalCount: number;
  totalIssues: number;
}) {
  let riskLabel: string;
  let riskColor: string;
  let riskDesc: string;
  let segColors: [string, string, string];

  if (score < 50 || criticalCount > 0) {
    riskLabel = 'HIGH COMPLIANCE RISK';
    riskColor = '#c62828';
    riskDesc  = `${totalIssues} issue${totalIssues !== 1 ? 's' : ''} may result in significant quality, security, or compliance problems. Immediate attention recommended.`;
    segColors = ['#e8e8e8', '#e8e8e8', '#c62828'];
  } else if (score < 80) {
    riskLabel = 'MEDIUM COMPLIANCE RISK';
    riskColor = '#f57c00';
    riskDesc  = `${totalIssues} issue${totalIssues !== 1 ? 's' : ''} found. Address warnings to reach optimal quality standards.`;
    segColors = ['#e8e8e8', '#f57c00', '#e8e8e8'];
  } else {
    riskLabel = 'LOW COMPLIANCE RISK';
    riskColor = '#388e3c';
    riskDesc  = 'No critical issues detected. Continued monitoring is recommended.';
    segColors = ['#388e3c', '#e8e8e8', '#e8e8e8'];
  }

  return (
    <div className="kpi-card">
      <p className="kpi-lbl">COMPLIANCE RISK</p>
      <div className="kpi-risk-top">
        <span className="kpi-risk-icon" style={{ color: riskColor }}>⚠</span>
        <span className="kpi-risk-text" style={{ color: riskColor }}>{riskLabel}</span>
      </div>
      <div className="kpi-risk-bar">
        {segColors.map((bg, i) => (
          <div key={i} className="kpi-risk-seg" style={{ background: bg }} />
        ))}
      </div>
      <div className="kpi-risk-labels">
        <span>Low</span><span>Medium</span><span>High</span>
      </div>
      <p className="kpi-risk-desc">{riskDesc}</p>
    </div>
  );
}

// ── KPI Card 3: Topics Summary ────────────────────────────────────────────────

function TopicsCard({ categoryScores }: { categoryScores: Record<string, number> }) {
  return (
    <div className="kpi-card">
      <p className="kpi-lbl">TOPICS ANALYSED</p>
      {Object.entries(categoryScores).map(([cat, score]) => {
        const color = scoreColor(score);
        return (
          <div key={cat} className="kpi-topic-row">
            <span className="kpi-topic-dot" style={{ background: color }} />
            <span className="kpi-topic-name">{categoryLabel(cat)}</span>
            <span className="kpi-topic-val" style={{ background: color }}>{score}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── KPI Card 4: Pages Scanned ─────────────────────────────────────────────────

function PagesCard({ pages_crawled, url }: { pages_crawled?: number; url: string }) {
  const count = pages_crawled ?? 1;
  return (
    <div className="kpi-card">
      <p className="kpi-lbl">SCANNED PAGES</p>
      <p className="kpi-pages-num">{count}</p>
      <p className="kpi-pages-sub">page{count !== 1 ? 's' : ''} scanned</p>
      <p className="kpi-pages-domain">{hostname(url)}</p>
      <p className="kpi-pages-note">out of entire domain</p>
    </div>
  );
}

// ── Flat issues list (public — first N visible, rest blurred + locked) ─────────

const VISIBLE_ISSUES = 3;

function issuePageLabel(f: Finding): { text: string; siteWide: boolean } | null {
  if (f.page_url) {
    try {
      const path = new URL(f.page_url).pathname || '/';
      // Show the path if it's an inner page; for homepage ('/') still show it
      return { text: path, siteWide: false };
    } catch { return null; }
  }
  if (f.pages_count && f.pages_count > 0) {
    return { text: `${f.pages_count} page${f.pages_count > 1 ? 's' : ''}`, siteWide: true };
  }
  // No specific URL and no pages_count — generic site-wide finding
  return { text: 'across all website', siteWide: true };
}

function IssuesList({ findings }: { findings: Finding[] }) {
  const issues = (['critical', 'warning', 'info'] as const).flatMap(sev =>
    findings.filter(f => f.severity === sev)
  );

  if (issues.length === 0) {
    return <p className="no-issues">No issues found — great work!</p>;
  }

  const visible    = issues.slice(0, VISIBLE_ISSUES);
  const blurred    = issues.slice(VISIBLE_ISSUES, VISIBLE_ISSUES + 3);
  const hiddenCount = Math.max(0, issues.length - VISIBLE_ISSUES);

  function chipClass(sev: string) {
    if (sev === 'critical') return 'chip chip-c';
    if (sev === 'warning')  return 'chip chip-w';
    return 'chip chip-i';
  }
  function chipLabel(sev: string) {
    if (sev === 'critical') return 'Critical';
    if (sev === 'warning')  return 'Warning';
    return 'Info';
  }

  return (
    <div className="issues-list">
      {visible.map((f, i) => {
        const pageLabel = issuePageLabel(f);
        return (
          <div key={i} className="issue-row">
            <span className={chipClass(f.severity)}>{chipLabel(f.severity)}</span>
            <div className="issue-body">
              <p className="issue-title">{f.title}</p>
              {(f.finding || f.description) && (
                <p className="issue-desc">{f.finding ?? f.description}</p>
              )}
              {pageLabel && (
                <span className={`finding-page-pill${pageLabel.siteWide ? ' finding-page-pill--wide' : ''}`}>
                  {pageLabel.text}
                </span>
              )}
            </div>
            <span className="issue-cat-ref">{categoryLabel(f.category)}</span>
          </div>
        );
      })}

      {hiddenCount > 0 && (
        <div className="locked-wrap">
          {blurred.map((f, i) => (
            <div key={i} className="issue-row issue-row--ghost">
              <span className={chipClass(f.severity)}>{chipLabel(f.severity)}</span>
              <div className="issue-body">
                <p className="issue-title">{f.title}</p>
              </div>
            </div>
          ))}
          <div className="locked-overlay">
            <p className="locked-count">{hiddenCount} MORE ISSUES FOUND</p>
            <p className="locked-hint">Get the full report to see all details and remediation guidance</p>
            <a className="locked-cta-btn" href="mailto:hello@devies.se">GET FULL REPORT →</a>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Category tab bar (detail breakdown) ──────────────────────────────────────

type ActiveTab = 'overview' | string;

function CategoryTabBar({
  categoryScores,
  activeTab,
  onTabChange,
}: {
  categoryScores: Record<string, number>;
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
}) {
  return (
    <div className="result-tabs" role="tablist" aria-label="Category breakdown">
      <button
        role="tab"
        aria-selected={activeTab === 'overview'}
        aria-controls="tabpanel-overview"
        className={`result-tab-btn${activeTab === 'overview' ? ' active' : ''}`}
        onClick={() => onTabChange('overview')}
      >
        Overview
      </button>

      {Object.entries(categoryScores).map(([cat, score]) => {
        const { cls } = gradeOf(score);
        const isActive = activeTab === cat;
        return (
          <button
            key={cat}
            role="tab"
            aria-selected={isActive}
            aria-controls={`tabpanel-${cat}`}
            className={`result-tab-btn${isActive ? ' active' : ''}`}
            onClick={() => onTabChange(cat)}
          >
            {categoryLabel(cat)}
            <span className={`cat-tab-score ${cls}`}>{score}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── Category bar (overview tab) ───────────────────────────────────────────────

function CategoryBar({ name, score }: { name: string; score: number }) {
  const { letter, cls } = gradeOf(score);
  return (
    <div className="cat-bar">
      <div className="cat-bar-row">
        <span className="cat-name">{categoryLabel(name)}</span>
        <span className={`cat-badge ${cls}`}>{score} · {letter}</span>
      </div>
      <div className="bar-track">
        <div className={`bar-fill ${cls}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

// ── Per-category issue summary (tab detail) ───────────────────────────────────

function CategoryIssueSummary({ findings }: { findings: Finding[] }) {
  const issues = (['critical', 'warning', 'info'] as const).flatMap(sev =>
    findings.filter(f => f.severity === sev)
  );

  if (issues.length === 0) {
    return <p className="no-findings">No issues found in this category — great work!</p>;
  }

  function chipClass(sev: string) {
    if (sev === 'critical') return 'chip chip-c';
    if (sev === 'warning')  return 'chip chip-w';
    return 'chip chip-i';
  }
  function chipLabel(sev: string) {
    if (sev === 'critical') return 'Critical';
    if (sev === 'warning')  return 'Warning';
    return 'Info';
  }

  const CATEGORY_VISIBLE = 2;
  const visible     = issues.slice(0, CATEGORY_VISIBLE);
  const hiddenCount = Math.max(0, issues.length - CATEGORY_VISIBLE);

  return (
    <div className="issues-list issues-list--cat">
      {visible.map((f, i) => {
        const pageLabel = issuePageLabel(f);
        return (
          <div key={i} className="issue-row">
            <span className={chipClass(f.severity)}>{chipLabel(f.severity)}</span>
            <div className="issue-body">
              <p className="issue-title">{f.title}</p>
              {pageLabel && (
                <span className={`finding-page-pill${pageLabel.siteWide ? ' finding-page-pill--wide' : ''}`}>
                  {pageLabel.text}
                </span>
              )}
            </div>
          </div>
        );
      })}
      {hiddenCount > 0 && (
        <div className="teaser-hidden-row">
          {hiddenCount} more issue{hiddenCount > 1 ? 's' : ''} — get the full report to see all details
        </div>
      )}
      <div className="teaser-cta">
        <p className="teaser-cta-text">
          Want to understand what these issues mean and how to resolve them?
        </p>
        <a className="cta-link" href="mailto:hello@devies.se">Get the full report</a>
      </div>
    </div>
  );
}

// ── Single site result ────────────────────────────────────────────────────────

function SiteResultCard({ result }: { result: SiteResult }) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');

  const criticalCount = result.findings.filter(f => f.severity === 'critical').length;
  const nonPositive   = result.findings.filter(f => f.severity !== 'positive');

  return (
    <div className="site-result">

      {/* URL bar */}
      <div className="result-url-bar">
        <span className="result-url-text">{result.url}</span>
        {result.platform && result.platform !== 'unknown' && (
          <span className="result-platform-badge">{result.platform}</span>
        )}
      </div>

      {/* 2×2 KPI grid */}
      <div className="kpi-grid">
        <ScoreCard score={result.overall_score} />
        <RiskCard
          score={result.overall_score}
          criticalCount={criticalCount}
          totalIssues={nonPositive.length}
        />
        <TopicsCard categoryScores={result.category_scores} />
        <PagesCard pages_crawled={result.pages_crawled} url={result.url} />
      </div>

      {/* Issues found section */}
      <div className="issues-section">
        <p className="section-head">ISSUES FOUND</p>
        <IssuesList findings={nonPositive} />
      </div>

      {/* Summary text */}
      {result.summary && (
        <div className="result-summary-bar">
          <p className="result-summary-text">{result.summary}</p>
        </div>
      )}

      {/* Category breakdown tabs */}
      <div className="breakdown-section">
        <p className="section-head">CATEGORY BREAKDOWN</p>
        <CategoryTabBar
          categoryScores={result.category_scores}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        {activeTab === 'overview' ? (
          <div id="tabpanel-overview" role="tabpanel" aria-label="Overview">
            <div className="categories-grid">
              {Object.entries(result.category_scores).map(([cat, score]) => (
                <CategoryBar key={cat} name={cat} score={score} />
              ))}
            </div>
            <div className="cta-box">
              <p className="cta-text">
                Need help improving your website health? Reach out and let's talk about it.
              </p>
              <a className="cta-link" href="mailto:hello@devies.se">hello@devies.se</a>
            </div>
          </div>
        ) : (
          <div
            id={`tabpanel-${activeTab}`}
            role="tabpanel"
            aria-label={categoryLabel(activeTab)}
            className="cat-detail"
          >
            <div className="cat-detail-hero">
              <div className="cat-detail-donut-wrap">
                {(() => {
                  const s = result.category_scores[activeTab] ?? 0;
                  const R = 32; const circ = 2 * Math.PI * R;
                  const fill = (s / 100) * circ;
                  const color = scoreColor(s);
                  return (
                    <svg width="80" height="80" viewBox="0 0 80 80" aria-hidden="true">
                      <circle cx="40" cy="40" r={R} fill="none" stroke="#ececec" strokeWidth="7" />
                      <circle
                        cx="40" cy="40" r={R} fill="none" stroke={color} strokeWidth="7"
                        strokeDasharray={`${fill.toFixed(2)} ${(circ - fill).toFixed(2)}`}
                        strokeLinecap="butt"
                        style={{ transition: 'stroke-dasharray .9s ease' }}
                      />
                      <text x="40" y="45" textAnchor="middle" fontSize="18" fontWeight="700" fill={color}>{s}</text>
                    </svg>
                  );
                })()}
              </div>
              <div>
                <div className="cat-detail-label">{categoryLabel(activeTab)}</div>
                <div className="cat-detail-sub">
                  {(() => {
                    const s = result.category_scores[activeTab] ?? 0;
                    const { letter } = gradeOf(s);
                    return `Score: ${s}/100 · Grade ${letter}`;
                  })()}
                </div>
              </div>
            </div>

            <CategoryIssueSummary
              findings={result.findings.filter(f => f.category === activeTab)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function SiteErrorCard({ result }: { result: { url: string | null; error: string } }) {
  return (
    <div className="site-result">
      <div className="error-box" style={{ margin: '24px 0' }}>
        <strong>Audit failed{result.url ? ` for ${result.url}` : ''}:</strong> {result.error}
      </div>
    </div>
  );
}

function SiteResultItemComp({ result }: { result: SiteResultItem }) {
  if (isSiteError(result)) return <SiteErrorCard result={result} />;
  return <SiteResultCard result={result} />;
}

// ── Root component ────────────────────────────────────────────────────────────

interface ScoreReportProps {
  results: AuditResults;
  onReset: () => void;
}

export default function ScoreReport({ results, onReset }: ScoreReportProps) {
  const { results: siteResults, name } = results;
  const [selected, setSelected] = useState(0);

  return (
    <div className="report-wrap">

      {/* Top bar */}
      <div className="report-top">
        <div>
          <DeviesHeader />
          <h2>Audit Results</h2>
          {name && (
            <p className="report-greeting">
              Hi {name}, here's your website report.
            </p>
          )}
        </div>
        <button className="new-audit-btn" onClick={onReset}>
          New Audit
        </button>
      </div>

      {/* Multi-URL site selector */}
      {siteResults.length > 1 && (
        <div className="site-tabs" role="tablist" aria-label="Select website">
          {siteResults.map((r, i) => {
            const isErr = isSiteError(r);
            const g = isErr ? null : gradeOf(r.overall_score);
            const label = r.url ? hostname(r.url) : 'Unknown';
            return (
              <button
                key={i}
                role="tab"
                aria-selected={selected === i}
                className={`site-tab${selected === i ? ' active' : ''}`}
                onClick={() => setSelected(i)}
              >
                {isErr
                  ? <span className="sev-badge sev-critical">Error</span>
                  : <span className={`tab-score ${g!.cls}`}>{(r as SiteResult).overall_score}</span>
                }
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Active site — key resets tab state when switching sites */}
      <SiteResultItemComp key={selected} result={siteResults[selected]} />
    </div>
  );
}
