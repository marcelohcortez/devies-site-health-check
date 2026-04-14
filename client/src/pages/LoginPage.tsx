import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const TOKEN_KEY = 'auditAdminToken';

export default function LoginPage() {
  const navigate              = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res  = await fetch('/api/auth/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ username, password }),
      });

      const data = await res.json() as { token?: string; error?: string };

      if (!res.ok) {
        setError(data.error ?? 'Invalid credentials.');
        return;
      }

      localStorage.setItem(TOKEN_KEY, data.token!);
      navigate('/submissions', { replace: true });
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <h1>Admin Login</h1>
        <p className="login-sub">Devies — Site Health Checker</p>

        <form onSubmit={handleSubmit} noValidate>
          <div className="field" style={{ marginBottom: 16 }}>
            <label htmlFor="login-username">Username</label>
            <input
              id="login-username"
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </div>

          <div className="field" style={{ marginBottom: 20 }}>
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          {error && (
            <div className="error-box" role="alert" style={{ marginBottom: 16 }}>
              {error}
            </div>
          )}

          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
