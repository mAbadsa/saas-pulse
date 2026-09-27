import { useCallback, useEffect, useState } from 'react';
import type { HealthCheckResponse } from '@saas-pulse/shared';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

function StatusBadge({ label, ok }: { label: string; ok: boolean }) {
  return (
    <Badge variant={ok ? 'outline' : 'destructive'} className={ok ? 'text-green-600 dark:text-green-400 border-green-600/30' : ''}>
      {label}: {ok ? 'ok' : 'error'}
    </Badge>
  );
}

function App() {
  const [health, setHealth] = useState<HealthCheckResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const checkHealth = useCallback(() => {
    return fetch(`${API_URL}/health`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<HealthCheckResponse>;
      })
      .then((data) => {
        setHealth(data);
        setError(null);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  useEffect(() => {
    void checkHealth();
  }, [checkHealth]);

  const handleRecheck = () => {
    setIsChecking(true);
    void checkHealth().finally(() => setIsChecking(false));
  };

  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col items-center justify-center gap-6 p-6">
      <div className="text-center">
        <h1 className="text-3xl font-semibold">SaaS Pulse</h1>
        <p className="text-muted-foreground text-sm">
          Monorepo: React + NestJS + shared types
        </p>
      </div>

      <Card className="w-full">
        <CardHeader>
          <CardTitle>API health</CardTitle>
          <CardDescription>
            {health
              ? `Last checked ${new Date(health.timestamp).toLocaleTimeString()}`
              : 'Checking dependencies…'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {error && !health && (
            <Badge variant="destructive" className="w-fit">
              Unable to reach the system: {error}
            </Badge>
          )}
          {!health && !error && (
            <p className="text-muted-foreground text-sm">Loading…</p>
          )}
          {health && (
            <>
              <Badge variant={health.status === 'ok' ? 'outline' : 'destructive'} className={health.status === 'ok' ? 'w-fit text-green-600 dark:text-green-400 border-green-600/30' : 'w-fit'}>
                overall: {health.status}
              </Badge>
              <div className="flex flex-wrap gap-2">
                <StatusBadge label="database" ok={health.services.database === 'ok'} />
                <StatusBadge label="redis" ok={health.services.redis === 'ok'} />
              </div>
            </>
          )}
          <Button
            variant="outline"
            size="sm"
            className="w-fit"
            disabled={isChecking}
            onClick={handleRecheck}
          >
            <RefreshCw className={isChecking ? 'animate-spin' : ''} />
            Re-check
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}

export default App;
