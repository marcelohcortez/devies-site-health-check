import { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import AuditForm from './components/AuditForm';
import ScoreReport from './components/ScoreReport';
import LoginPage from './pages/LoginPage';
import SubmissionsPage from './pages/SubmissionsPage';
import type { AuditResults, FormData } from './types';

type View = 'form' | 'loading' | 'results';

function AuditApp() {
  const [view,       setView]       = useState<View>('form');
  const [results,    setResults]    = useState<AuditResults | null>(null);
  const [error,      setError]      = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(formData: FormData) {
    setSubmitting(true);
    setView('loading');
    setError(null);

    try {
      const res  = await fetch('/api/audit', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(formData),
      });

      const data = await res.json() as { results: AuditResults['results']; error?: string };

      if (!res.ok) throw new Error(data.error ?? 'Audit failed. Please try again.');

      setResults({ ...data, name: formData.name });
      setView('results');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Audit failed. Please try again.');
      setView('form');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="app">
      {/* Keep AuditForm mounted during loading so field state is preserved on error */}
      <div style={{ display: view === 'form' ? undefined : 'none' }}>
        <AuditForm onSubmit={handleSubmit} error={error} submitting={submitting} />
      </div>

      {view === 'loading' && (
        <div className="loading-screen">
          <div className="spinner" />
          <p className="loading-title">Running audit…</p>
          <p className="loading-sub">
            Analysing SEO, Security, Performance, Accessibility and more.
            <br />This may take up to 30 seconds per site.
          </p>
        </div>
      )}

      {view === 'results' && results && (
        <ScoreReport
          results={results}
          onReset={() => { setView('form'); setResults(null); }}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/"            element={<AuditApp />} />
      <Route path="/login"       element={<LoginPage />} />
      <Route path="/submissions" element={<SubmissionsPage />} />
      <Route path="*"            element={<AuditApp />} />
    </Routes>
  );
}
