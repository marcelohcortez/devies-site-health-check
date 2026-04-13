import { useState } from 'react';

// ── Helpers ───────────────────────────────────────────────────────────────────

function gradeOf(score) {
  if (score >= 90) return { letter: 'A', cls: 'grade-a' };
  if (score >= 80) return { letter: 'B', cls: 'grade-b' };
  if (score >= 70) return { letter: 'C', cls: 'grade-c' };
  if (score >= 60) return { letter: 'D', cls: 'grade-d' };
  return              { letter: 'F', cls: 'grade-f' };
}

function hostname(url) {
  try { return new URL(url).hostname; }
  catch { return url; }
}

function categoryLabel(key) {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

// ── Score circle (SVG donut) ──────────────────────────────────────────────────

function ScoreCircle({ score }) {
  const { letter, cls } = gradeOf(score);
  const R    = 54;
  const circ = 2 * Math.PI * R;
  const fill = (score / 100) * circ;

  return (
    <div className={`score-circle ${cls}`} aria-label={`Score ${score}, grade ${letter}`}>
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

function CategoryBar({ name, score }) {
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

// ── Findings panel — hidden pending paywall (T-056) ──────────────────────────
// eslint-disable-next-line no-unused-vars

const SEV_ORDER  = ['critical', 'warning', 'info', 'positive'];
const SEV_LABELS = { critical: 'Critical', warning: 'Warning', info: 'Info', positive: 'Positive' };

function FindingsPanel({ findings }) {
  const grouped = SEV_ORDER.reduce((acc, sev) => {
    const items = findings.filter(f => f.severity === sev);
    if (items.length) acc[sev] = items;
    return acc;
  }, {});

  if (Object.keys(grouped).length === 0) {
    return <p className="no-findings">No issues found — great work!</p>;
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
              {(f.finding || f.description) && (
                <div className="finding-desc">{f.finding || f.description}</div>
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

// ── Single site result ────────────────────────────────────────────────────────

function SiteResult({ result }) {
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

      {/* Category scores */}
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
  );
}

// ── Root component ────────────────────────────────────────────────────────────

export default function ScoreReport({ results, onReset }) {
  const { results: siteResults, name } = results;
  const [selected, setSelected] = useState(0);

  return (
    <div className="report-wrap">

      {/* Top bar */}
      <div className="report-top">
        <div>
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
            const g = gradeOf(r.overall_score);
            return (
              <button
                key={i}
                role="tab"
                aria-selected={selected === i}
                className={`site-tab${selected === i ? ' active' : ''}`}
                onClick={() => setSelected(i)}
              >
                <span className={`tab-score ${g.cls}`}>{r.overall_score}</span>
                <span>{hostname(r.url)}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Active site */}
      <SiteResult result={siteResults[selected]} />
    </div>
  );
}
