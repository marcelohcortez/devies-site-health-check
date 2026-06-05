import { useState } from 'react';
import type { FormData } from '../types';
import DeviesHeader from './DeviesHeader';

interface AuditFormProps {
  onSubmit: (data: FormData) => void;
  error: string | null;
  submitting: boolean;
}

/**
 * AuditForm
 *
 * Collects: name, email, and a single website URL.
 * Calls onSubmit({ name, email, urls }) when the form is submitted.
 * `submitting` is controlled by the parent so the button resets correctly
 * when the user clicks "New Audit" after a successful run.
 */
export default function AuditForm({ onSubmit, error, submitting }: AuditFormProps) {
  const [name,    setName]    = useState('');
  const [email,   setEmail]   = useState('');
  const [url,     setUrl]     = useState('');
  const [consent, setConsent] = useState(false);

  // ── Submit ───────────────────────────────────────────────────────────────
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!consent) return;
    onSubmit({ name: name.trim(), email: email.trim(), urls: [url.trim()], consent: true });
  }

  return (
    <div className="form-wrap">
      <div className="form-card">

        {/* ── Header ── */}
        <div className="form-header">
          <DeviesHeader />
          <h1>Get Your Free<br />Website Audit</h1>
          <p>
            Instant analysis across SEO, Security, Performance, Accessibility
            and more — no login required.
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

          {/* URL input */}
          <div className="field">
            <label htmlFor="url">Website URL</label>
            <input
              id="url"
              type="url"
              placeholder="https://example.com"
              value={url}
              onChange={e => setUrl(e.target.value)}
              required
            />
          </div>

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
