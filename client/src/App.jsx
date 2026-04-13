import { useState } from 'react';
import AuditForm from './components/AuditForm.jsx';
import ScoreReport from './components/ScoreReport.jsx';

// View states: 'form' | 'loading' | 'results'
export default function App() {
  const [view, setView]       = useState('form');
  const [results, setResults] = useState(null);
  const [error, setError]     = useState(null);

  async function handleSubmit(formData) {
    setView('loading');
    setError(null);

    try {
      const res  = await fetch('/api/audit', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Audit failed. Please try again.');

      setResults({ ...data, name: formData.name });
      setView('results');
    } catch (err) {
      setError(err.message);
      setView('form');
    }
  }

  return (
    <div className="app">
      {/* Keep AuditForm mounted during loading so field state is preserved on error */}
      <div style={{ display: view === 'form' ? undefined : 'none' }}>
        <AuditForm onSubmit={handleSubmit} error={error} />
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
