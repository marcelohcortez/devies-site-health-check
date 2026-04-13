import { useState, useEffect } from 'react';

/**
 * AuditForm
 *
 * Collects: name, email, one or multiple URLs (max 10).
 * Calls onSubmit({ name, email, urls }) when the form is submitted.
 */
export default function AuditForm({ onSubmit, error }) {
  const [name,       setName]       = useState('');
  const [email,      setEmail]      = useState('');
  const [mode,       setMode]       = useState('single');   // 'single' | 'multiple'
  const [singleUrl,  setSingleUrl]  = useState('');
  const [multiText,  setMultiText]  = useState('');
  const [submitting, setSubmitting] = useState(false);

  // ── Reset submitting when an error comes back from App ──────────────────
  useEffect(() => { if (error) setSubmitting(false); }, [error]);

  // ── Derive URL count from textarea ───────────────────────────────────────
  const parsedUrls = multiText.split('\n').map(u => u.trim()).filter(Boolean);
  const urlCount   = Math.min(parsedUrls.length, 10);

  // ── Submit ───────────────────────────────────────────────────────────────
  function handleSubmit(e) {
    e.preventDefault();

    const urlList =
      mode === 'single'
        ? [singleUrl.trim()]
        : parsedUrls.slice(0, 10);

    setSubmitting(true);
    onSubmit({ name: name.trim(), email: email.trim(), urls: urlList });
  }

  return (
    <div className="form-wrap">
      <div className="form-card">

        {/* ── Header ── */}
        <div className="form-header">
          <div className="form-logo">
            <svg className="form-logo-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 2L2 7l10 5 10-5-10-5z"  stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
              <path d="M2 17l10 5 10-5"              stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
              <path d="M2 12l10 5 10-5"              stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
            </svg>
            <span style={{ fontWeight: 700, fontSize: 18 }}>Devies - Site Health Checker</span>
          </div>
          <p>
            Get a comprehensive analysis of your website's SEO, Security,
            Performance and Accessibility — free, instant, no login required.
          </p>
        </div>

        {/* ── Body ── */}
        <form className="form-body" onSubmit={handleSubmit} noValidate>

          {/* Name + Email */}
          <div className="field-row">
            <div className="field">
              <label htmlFor="name">Your Name</label>
              <input
                id="name"
                type="text"
                placeholder="Jane Smith"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                autoComplete="name"
              />
            </div>
            <div className="field">
              <label htmlFor="email">Email Address</label>
              <input
                id="email"
                type="email"
                placeholder="jane@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
          </div>

          {/* Mode toggle */}
          <div className="mode-toggle" role="group" aria-label="Audit mode">
            <button
              type="button"
              className={`toggle-btn${mode === 'single' ? ' active' : ''}`}
              onClick={() => setMode('single')}
            >
              Single Website
            </button>
            <button
              type="button"
              className={`toggle-btn${mode === 'multiple' ? ' active' : ''}`}
              onClick={() => setMode('multiple')}
            >
              Multiple Websites
            </button>
          </div>

          {/* URL input(s) */}
          {mode === 'single' ? (
            <div className="field">
              <label htmlFor="url-single">Website URL</label>
              <input
                id="url-single"
                type="url"
                placeholder="https://example.com"
                value={singleUrl}
                onChange={e => setSingleUrl(e.target.value)}
                required
              />
            </div>
          ) : (
            <div className="field">
              <label htmlFor="url-multi">
                Website URLs
                <span className="label-hint"> ({urlCount} / 10)</span>
              </label>
              <textarea
                id="url-multi"
                className="url-textarea"
                placeholder={'https://site1.com\nhttps://site2.com\nhttps://site3.com'}
                value={multiText}
                onChange={e => setMultiText(e.target.value)}
                rows={5}
                required
                aria-label="One URL per line, up to 10"
              />
              <span className="label-hint" style={{ fontSize: 12 }}>
                One URL per line — up to 10. Extra lines are ignored.
              </span>
            </div>
          )}

          {/* Error */}
          {error && <div className="error-box" role="alert">{error}</div>}

          {/* Submit */}
          <button
            type="submit"
            className="submit-btn"
            disabled={submitting}
          >
            {submitting ? 'Running…' : 'Run Audit'}
          </button>
        </form>
      </div>
    </div>
  );
}
