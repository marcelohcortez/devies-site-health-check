import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Finding } from '../types';

const TOKEN_KEY  = 'auditAdminToken';
const PAGE_SIZE  = 50;

// ── Types ─────────────────────────────────────────────────────────────────────

interface Submission {
  id:         number;
  name:       string;
  email:      string;
  url:        string;
  score:      number | null;
  platform:   string | null;
  created_at: string;
}

interface AuditData {
  url:         string;
  generated_at: string;
  platform_name: string;
  interpretation: {
    overall_score:   number;
    summary:         string;
    category_scores: Record<string, number>;
    findings:        Finding[];
  };
  http?: Record<string, unknown>;
  platform?: Record<string, unknown>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function gradeOf(score: number) {
  if (score >= 90) return { letter: 'A', cls: 'grade-a' };
  if (score >= 80) return { letter: 'B', cls: 'grade-b' };
  if (score >= 70) return { letter: 'C', cls: 'grade-c' };
  if (score >= 60) return { letter: 'D', cls: 'grade-d' };
  return              { letter: 'F', cls: 'grade-f' };
}

function categoryLabel(key: string) {
  return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

function hostname(url: string) {
  try { return new URL(url).hostname; } catch { return url; }
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem(TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : { Authorization: '' };
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function CategoryBars({ scores }: { scores: Record<string, number> }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {Object.entries(scores).map(([cat, score]) => {
        const { letter, cls } = gradeOf(score);
        return (
          <div key={cat} className="cat-bar">
            <div className="cat-bar-row">
              <span className="cat-name">{categoryLabel(cat)}</span>
              <span className={`cat-badge ${cls}`}>{score} · {letter}</span>
            </div>
            <div className="bar-track">
              <div className={`bar-fill ${cls}`} style={{ width: `${score}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

const SEV_ORDER: Finding['severity'][] = ['critical', 'warning', 'info', 'positive'];
const SEV_LABELS: Record<string, string> = { critical: 'Critical', warning: 'Warning', info: 'Info', positive: 'Positive' };

function FindingsPanel({ findings }: { findings: Finding[] }) {
  const grouped = SEV_ORDER.reduce<Record<string, Finding[]>>((acc, sev) => {
    const items = findings.filter(f => f.severity === sev);
    if (items.length) acc[sev] = items;
    return acc;
  }, {});

  if (Object.keys(grouped).length === 0) {
    return <p className="no-findings">No issues found.</p>;
  }

  return (
    <div>
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
                <div className="finding-desc">{f.finding ?? f.description}</div>
              )}
              {f.how_to_fix && (
                <div className="finding-fix"><strong>Fix: </strong>{f.how_to_fix}</div>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Detail panel ──────────────────────────────────────────────────────────────

function DetailPanel({ submission, onClose }: { submission: Submission; onClose: () => void }) {
  const navigate                    = useNavigate();
  const [data,    setData]          = useState<AuditData | null>(null);
  const [loading, setLoading]       = useState(true);
  const [error,   setError]         = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/submissions/${submission.id}/data`, { headers: authHeaders() })
      .then(async res => {
        if (res.status === 401) { navigate('/login', { replace: true }); return; }
        if (!res.ok) throw new Error('Failed to load audit data.');
        const json = await res.json() as AuditData;
        if (!cancelled) setData(json);
      })
      .catch(err => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [submission.id, navigate]);

  function downloadJson() {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `audit-${submission.id}-${hostname(submission.url)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="detail-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="detail-panel" role="dialog" aria-modal="true" aria-label="Submission detail">

        <div className="detail-header">
          <h2 title={submission.url}>{hostname(submission.url)}</h2>
          <button className="detail-close" onClick={onClose}>Close</button>
        </div>

        <div className="detail-body">
          {loading && (
            <div className="detail-loading">
              <div className="spinner" style={{ width: 24, height: 24, borderWidth: 2 }} />
              Loading audit data…
            </div>
          )}

          {error && <div className="error-box">{error}</div>}

          {data && (
            <>
              {/* Summary */}
              <div className="detail-section">
                <p className="detail-section-title">Summary</p>
                <p className="detail-summary">{data.interpretation.summary}</p>
              </div>

              {/* Category scores */}
              <div className="detail-section">
                <p className="detail-section-title">Category Scores</p>
                <CategoryBars scores={data.interpretation.category_scores} />
              </div>

              {/* Findings */}
              <div className="detail-section">
                <p className="detail-section-title">Findings</p>
                <FindingsPanel findings={data.interpretation.findings} />
              </div>

              {/* Raw metadata (collapsible) */}
              <div className="detail-section">
                <details className="collapsible">
                  <summary>Raw Metadata</summary>
                  <div className="meta-grid">
                    <span className="meta-key">Generated</span>
                    <span className="meta-val">{data.generated_at}</span>
                    <span className="meta-key">Platform</span>
                    <span className="meta-val">{data.platform_name}</span>
                    {data.http && (
                      <>
                        <span className="meta-key">Status</span>
                        <span className="meta-val">{String((data.http as Record<string, unknown>).status_code ?? '—')}</span>
                        <span className="meta-key">Response time</span>
                        <span className="meta-val">{String((data.http as Record<string, unknown>).response_time_ms ?? '—')} ms</span>
                        <span className="meta-key">HTTPS</span>
                        <span className="meta-val">{String((data.http as Record<string, unknown>).https ?? '—')}</span>
                        <span className="meta-key">Server</span>
                        <span className="meta-val">{String((data.http as Record<string, unknown>).server ?? '—')}</span>
                      </>
                    )}
                    {data.platform && typeof data.platform === 'object' && 'signals' in (data.platform as Record<string, unknown>) && (
                      <>
                        <span className="meta-key">Signals</span>
                        <span className="meta-val">
                          {((data.platform as Record<string, unknown>).signals as string[] | undefined)?.join(', ') ?? '—'}
                        </span>
                      </>
                    )}
                  </div>
                </details>
              </div>
            </>
          )}
        </div>

        <div className="detail-actions">
          <button className="btn-secondary" onClick={downloadJson} disabled={!data}>
            Download JSON
          </button>
          <button className="btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SubmissionsPage() {
  const navigate                            = useNavigate();
  const [submissions, setSubmissions]       = useState<Submission[]>([]);
  const [loading,     setLoading]           = useState(true);
  const [error,       setError]             = useState<string | null>(null);
  const [filter,      setFilter]            = useState('');
  const [page,        setPage]              = useState(1);
  const [selected,    setSelected]          = useState<Submission | null>(null);

  // ── Auth guard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) { navigate('/login', { replace: true }); return; }

    // Client-side expiry check — decode JWT payload without verification
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.exp && Date.now() / 1000 > payload.exp) {
        localStorage.removeItem(TOKEN_KEY);
        navigate('/login', { replace: true });
      }
    } catch { /* malformed — let the API reject it */ }
  }, [navigate]);

  // ── Load submissions ────────────────────────────────────────────────────────
  const load = useCallback(() => {
    setLoading(true);
    setError(null);

    fetch('/api/submissions', { headers: authHeaders() })
      .then(async res => {
        if (res.status === 401) { navigate('/login', { replace: true }); return; }
        if (!res.ok) throw new Error('Failed to load submissions.');
        const json = await res.json() as { submissions: Submission[] };
        setSubmissions(json.submissions ?? []);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [navigate]);

  useEffect(() => { load(); }, [load]);

  // ── Logout ──────────────────────────────────────────────────────────────────
  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    navigate('/login', { replace: true });
  }

  // ── Filter + paginate ───────────────────────────────────────────────────────
  const filtered = filter.trim()
    ? submissions.filter(s =>
        s.email.toLowerCase().includes(filter.toLowerCase()) ||
        s.url.toLowerCase().includes(filter.toLowerCase())
      )
    : submissions;

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="app">
      <div className="admin-wrap">

        {/* Header */}
        <div className="admin-header">
          <h1>Submissions</h1>
          <div className="admin-header-actions">
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>
              {filtered.length} total
            </span>
            <button className="btn-secondary" onClick={load}>Refresh</button>
            <button className="btn-secondary" onClick={logout}>Logout</button>
          </div>
        </div>

        {/* Filter */}
        <div className="admin-filter">
          <input
            type="text"
            placeholder="Filter by email or URL…"
            value={filter}
            onChange={e => { setFilter(e.target.value); setPage(1); }}
          />
        </div>

        {/* States */}
        {loading && <p style={{ color: 'var(--muted)', fontSize: 14 }}>Loading…</p>}
        {error   && <div className="error-box">{error}</div>}

        {/* Table */}
        {!loading && !error && (
          <>
            {paginated.length === 0 ? (
              <div className="empty-state">No submissions yet.</div>
            ) : (
              <div className="submissions-table-wrap">
                <table className="submissions-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Name</th>
                      <th>Email</th>
                      <th>URL</th>
                      <th>Score</th>
                      <th>Platform</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map(s => {
                      const g = s.score != null ? gradeOf(s.score) : null;
                      return (
                        <tr key={s.id}>
                          <td style={{ whiteSpace: 'nowrap', fontSize: 13 }}>{formatDate(s.created_at)}</td>
                          <td>{s.name}</td>
                          <td style={{ fontSize: 13 }}>{s.email}</td>
                          <td className="url-cell" title={s.url}>{s.url}</td>
                          <td>
                            {g && s.score != null ? (
                              <span className={`score-badge ${g.cls}`}>
                                {s.score} <span style={{ fontSize: 11 }}>{g.letter}</span>
                              </span>
                            ) : '—'}
                          </td>
                          <td>
                            {s.platform ? (
                              <span className="platform-chip">{s.platform}</span>
                            ) : '—'}
                          </td>
                          <td>
                            <button
                              className="btn-secondary"
                              style={{ fontSize: 12, padding: '5px 12px' }}
                              onClick={() => setSelected(s)}
                            >
                              View details
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="pagination">
                <span>Page {page} of {totalPages}</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="btn-secondary"
                    disabled={page <= 1}
                    onClick={() => setPage(p => p - 1)}
                  >
                    Previous
                  </button>
                  <button
                    className="btn-secondary"
                    disabled={page >= totalPages}
                    onClick={() => setPage(p => p + 1)}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Detail panel */}
      {selected && (
        <DetailPanel
          submission={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
