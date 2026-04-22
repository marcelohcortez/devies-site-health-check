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

// ── Score circle (SVG donut) ──────────────────────────────────────────────────

function ScoreCircle({ score, size = 120 }: { score: number; size?: number }) {
  const { letter, cls } = gradeOf(score);
  const R    = 54;
  const circ = 2 * Math.PI * R;
  const fill = (score / 100) * circ;

  return (
    <div
      className={`score-circle ${cls}`}
      aria-label={`Score ${score}, grade ${letter}`}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 120 120">
        {/* Track */}
        <circle cx="60" cy="60" r={R} fill="none" stroke="var(--track)" strokeWidth="10" />
        {/* Filled arc */}
        <circle
          cx="60" cy="60" r={R}
          fill="none"
          stroke="currentColor"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${fill} ${circ - fill}`}
          transform="rotate(-90 60 60)"
          style={{ transition: 'stroke-dasharray 1s ease' }}
        />
      </svg>
      <div className="score-inner">
        <span className="score-num">{score}</span>
        <span className="score-letter">{letter}</span>
      </div>
    </div>
  );
}

// ── Category bar ─────────────────────────────────────────────────────────────

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

// ── Shared severity constants ─────────────────────────────────────────────────

const SEV_ORDER  = ['critical', 'warning', 'info', 'positive'] as const;
const SEV_LABELS: Record<string, string> = { critical: 'Critical', warning: 'Warning', info: 'Info', positive: 'Positive' };

// ── Full findings panel (admin / SubmissionsPage only) ────────────────────────

function FindingsPanel({ findings }: { findings: Finding[] }) {
  const grouped = SEV_ORDER.reduce<Record<string, Finding[]>>((acc, sev) => {
    const items = findings.filter(f => f.severity === sev);
    if (items.length) acc[sev] = items;
    return acc;
  }, {});

  if (Object.keys(grouped).length === 0) {
    return <p className="no-findings">No issues found in this category — great work!</p>;
  }

  return (
    <div className="findings-panel">
      {Object.entries(grouped).map(([sev, items]) => (
        <div key={sev} className="findings-section">
          <div className="findings-section-title">
            <span className={`sev-badge sev-${sev}`}>{SEV_LABELS[sev]}</span>
            {items.length} issue{items.length !== 1 ? 's' : ''}
          </div>

          {items.map((f, i) => (
            <div key={i} className="finding-card">
              <div className="finding-title">{f.title}</div>
              {f.page_url && (
                <div className="finding-page">
                  {(() => { try { return new URL(f.page_url).pathname || '/'; } catch { return f.page_url; } })()}
                </div>
              )}
              {(f.finding || f.description) && (
                <div className="finding-desc">{f.finding ?? f.description}</div>
              )}
              {f.how_to_fix && (
                <div className="finding-fix">
                  <strong>Fix: </strong>{f.how_to_fix}
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Issue summary panel (public category tabs) ────────────────────────────────
// Shows issue existence and location — deliberately withholds technical details
// and fix instructions so users need the full report to act on findings.

const TEASER_VISIBLE = 2; // findings shown per severity tier before locking

function findingPageLabel(f: Finding): string | null {
  if (f.page_url) {
    try {
      const path = new URL(f.page_url).pathname || '/';
      return path === '/' ? null : path; // skip root — obvious, adds no info
    } catch { return null; }
  }
  if (f.pages_count && f.pages_count > 0) {
    return `${f.pages_count} page${f.pages_count > 1 ? 's' : ''}`;
  }
  return null;
}

const TEASER_SEV_ORDER = SEV_ORDER.filter(s => s !== 'positive');

function IssueSummaryPanel({ findings }: { findings: Finding[] }) {
  const grouped = TEASER_SEV_ORDER.reduce<Record<string, Finding[]>>((acc, sev) => {
    const items = findings.filter(f => f.severity === sev);
    if (items.length) acc[sev] = items;
    return acc;
  }, {});

  if (Object.keys(grouped).length === 0) {
    return <p className="no-findings">No issues found in this category — great work!</p>;
  }

  return (
    <div className="findings-panel">
      {Object.entries(grouped).map(([sev, items]) => {
        const visible = items.slice(0, TEASER_VISIBLE);
        const hidden  = items.length - visible.length;

        return (
          <div key={sev} className="findings-section">
            <div className="findings-section-title">
              <span className={`sev-badge sev-${sev}`}>{SEV_LABELS[sev]}</span>
              {items.length} issue{items.length !== 1 ? 's' : ''}
            </div>

            {visible.map((f, i) => {
              const pageLabel = findingPageLabel(f);
              return (
                <div key={i} className="finding-card finding-card--teaser">
                  <div className="finding-title">{f.title}</div>
                  {pageLabel && (
                    <div className="finding-page-pill">{pageLabel}</div>
                  )}
                </div>
              );
            })}

            {hidden > 0 && (
              <div className="teaser-hidden-row">
                {hidden} more issue{hidden > 1 ? 's' : ''} — get the full report to see all details
              </div>
            )}
          </div>
        );
      })}

      <div className="teaser-cta">
        <p className="teaser-cta-text">
          Want to understand what these issues mean and how to resolve them?
        </p>
        <a className="cta-link" href="mailto:hello@devies.se">
          Get the full report
        </a>
      </div>
    </div>
  );
}

// ── Category tab bar ──────────────────────────────────────────────────────────

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
      {/* Overview tab */}
      <button
        role="tab"
        aria-selected={activeTab === 'overview'}
        aria-controls="tabpanel-overview"
        className={`result-tab-btn${activeTab === 'overview' ? ' active' : ''}`}
        onClick={() => onTabChange('overview')}
      >
        Overview
      </button>

      {/* One tab per category */}
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

// ── Single site result ────────────────────────────────────────────────────────

function SiteResultCard({ result }: { result: SiteResult }) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');

  const criticalCount = result.findings.filter(f => f.severity === 'critical').length;
  const warningCount  = result.findings.filter(f => f.severity === 'warning').length;

  return (
    <div className="site-result">
      {/* Hero */}
      <div className="result-hero">
        <ScoreCircle score={result.overall_score} />

        <div className="result-meta">
          <p className="result-url">{result.url}</p>
          <p className="result-summary">{result.summary}</p>
          <p className="result-platform">
            Platform: <strong>{result.platform || 'unknown'}</strong>
            {result.pages_crawled != null && (
              <span className="pages-crawled-badge" style={{ marginLeft: 10 }}>
                {result.pages_crawled} page{result.pages_crawled !== 1 ? 's' : ''} scanned
              </span>
            )}
            {criticalCount > 0 && (
              <span className="sev-badge sev-critical" style={{ marginLeft: 10 }}>
                {criticalCount} critical
              </span>
            )}
            {warningCount > 0 && (
              <span className="sev-badge sev-warning" style={{ marginLeft: 6 }}>
                {warningCount} warnings
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Category tab bar */}
      <CategoryTabBar
        categoryScores={result.category_scores}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Tab content */}
      {activeTab === 'overview' ? (
        <div id="tabpanel-overview" role="tabpanel" aria-label="Overview">
          {/* All category bars */}
          <div className="categories-grid">
            {Object.entries(result.category_scores).map(([cat, score]) => (
              <CategoryBar key={cat} name={cat} score={score} />
            ))}
          </div>

          {/* CTA */}
          <div className="cta-box">
            <p className="cta-text">
              Need help improving your website health?{' '}
              Want more information about the issues found?{' '}
              Reach out to us and let's talk about it.
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
          {/* Category score */}
          <div className="cat-detail-hero">
            <ScoreCircle score={result.category_scores[activeTab] ?? 0} size={96} />
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

          {/* Issue summary — titles only, no technical details or fixes */}
          <IssueSummaryPanel
            findings={result.findings.filter(f => f.category === activeTab)}
          />
        </div>
      )}
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

      {/* Active site — key resets category tab state when switching sites */}
      <SiteResultItemComp key={selected} result={siteResults[selected]} />
    </div>
  );
}
