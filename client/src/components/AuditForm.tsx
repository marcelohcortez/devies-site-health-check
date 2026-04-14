import { useState } from 'react';
import type { FormData } from '../types';

interface AuditFormProps {
  onSubmit: (data: FormData) => void;
  error: string | null;
  submitting: boolean;
}

/**
 * AuditForm
 *
 * Collects: name, email, one or multiple URLs (max 10).
 * Calls onSubmit({ name, email, urls }) when the form is submitted.
 * `submitting` is controlled by the parent so the button resets correctly
 * when the user clicks "New Audit" after a successful run.
 */
export default function AuditForm({ onSubmit, error, submitting }: AuditFormProps) {
  const [name,      setName]      = useState('');
  const [email,     setEmail]     = useState('');
  const [mode,      setMode]      = useState<'single' | 'multiple'>('single');
  const [singleUrl, setSingleUrl] = useState('');
  const [multiText, setMultiText] = useState('');
  const [consent,   setConsent]   = useState(false);

  // ── Derive URL count from textarea ───────────────────────────────────────
  const parsedUrls = multiText.split('\n').map(u => u.trim()).filter(Boolean);
  const urlCount   = Math.min(parsedUrls.length, 10);

  // ── Submit ───────────────────────────────────────────────────────────────
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const urlList =
      mode === 'single'
        ? [singleUrl.trim()]
        : parsedUrls.slice(0, 10);

    if (!consent) return;
    onSubmit({ name: name.trim(), email: email.trim(), urls: urlList, consent: true });
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
              />
              <span className="label-hint" style={{ fontSize: 12 }}>
                One URL per line — up to 10. Extra lines are ignored.
              </span>
            </div>
          )}

          {/* Consent */}
          <label className="consent-row">
            <input
              type="checkbox"
              checked={consent}
              onChange={e => setConsent(e.target.checked)}
              required
            />
            I agree to my data being used to generate this audit report.
          </label>

          {/* Error */}
          {error && <div className="error-box" role="alert">{error}</div>}

          {/* Submit */}
          <button
            type="submit"
            className="submit-btn"
            disabled={submitting || !consent}
          >
            {submitting ? 'Running…' : 'Run Audit'}
          </button>
        </form>
      </div>
    </div>
  );
}
