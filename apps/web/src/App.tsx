import { useEffect, useState } from 'react';
import type { HealthCheckResponse } from '@saas-pulse/shared';
import './App.css';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

function App() {
  const [health, setHealth] = useState<HealthCheckResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/health`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<HealthCheckResponse>;
      })
      .then(setHealth)
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <main className="app">
      <h1>SaaS Pulse</h1>
      <p>Monorepo: React + NestJS + shared types</p>

      <section className="health">
        <h2>API health</h2>
        {error && <p className="error">{error}</p>}
        {!health && !error && <p>Loading…</p>}
        {health && (
          <pre>{JSON.stringify(health, null, 2)}</pre>
        )}
      </section>
    </main>
  );
}

export default App;
