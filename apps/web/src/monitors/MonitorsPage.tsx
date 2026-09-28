import type { MonitorResponse } from '@saas-pulse/shared';
import { Activity, LogOut, Plus, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/auth/auth-context';
import { Button } from '@/components/ui/button';
import { api, ApiError } from '@/lib/api';
import { DeleteMonitorDialog } from './DeleteMonitorDialog';
import { MonitorFormDialog } from './MonitorFormDialog';
import { MonitorRow } from './MonitorRow';

const REFRESH_MS = 15_000;

export function MonitorsPage() {
  const { user, signOut } = useAuth();
  const [monitors, setMonitors] = useState<MonitorResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  // null = closed, 'new' = add, otherwise the monitor being edited
  const [editing, setEditing] = useState<MonitorResponse | 'new' | null>(null);
  const [deleting, setDeleting] = useState<MonitorResponse | null>(null);

  // State is only set in promise callbacks: load() runs from an effect (react-hooks/set-state-in-effect).
  const load = useCallback(
    () =>
      api<MonitorResponse[]>('/monitors')
        .then((data) => {
          setMonitors(data);
          setError(null);
        })
        .catch((err: unknown) => {
          // 401 is handled globally (sign out); otherwise keep showing the last good data.
          if (err instanceof ApiError && err.status !== 401) {
            setError(err.messages.join(' '));
          }
        }),
    [],
  );

  // Initial load + refresh every 15 s while the tab is visible (status changes from the ping service).
  useEffect(() => {
    void load();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  const toggle = async (m: MonitorResponse) => {
    setBusyId(m.id);
    try {
      await api(`/monitors/${m.id}`, {
        method: 'PATCH',
        body: { isActive: !m.isActive },
      });
    } catch (err) {
      if (err instanceof ApiError) setError(err.messages.join(' '));
    } finally {
      await load();
      setBusyId(null);
    }
  };

  const addButton = (
    <Button onClick={() => setEditing('new')}>
      <Plus aria-hidden />
      Add monitor
    </Button>
  );

  return (
    <div className="min-h-svh">
      <header className="border-b">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">
          <Activity aria-hidden className="text-primary size-5" />
          <span className="font-semibold">SaaS Pulse</span>
          <span className="text-muted-foreground ml-auto hidden truncate text-sm sm:inline">
            {user?.email}
          </span>
          <Button variant="ghost" size="sm" onClick={() => signOut()} className="ml-auto sm:ml-0">
            <LogOut aria-hidden />
            Sign out
          </Button>
        </div>
      </header>

      <main className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Monitors</h1>
            <p className="text-muted-foreground text-sm">
              Updates automatically every {REFRESH_MS / 1000} seconds.
            </p>
          </div>
          {monitors && monitors.length > 0 && addButton}
        </div>

        {error && (
          <div
            role="alert"
            className="border-destructive/40 bg-destructive/5 text-destructive flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm"
          >
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={() => void load()}>
              <RefreshCw aria-hidden />
              Try again
            </Button>
          </div>
        )}

        {monitors === null && !error && (
          <p className="text-muted-foreground" aria-busy="true">
            Loading monitors…
          </p>
        )}

        {monitors?.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-10 text-center">
            <Activity aria-hidden className="text-muted-foreground size-8" />
            <div>
              <h2 className="font-medium">No monitors yet</h2>
              <p className="text-muted-foreground text-sm">
                Add a website or API endpoint and we’ll check it for you.
              </p>
            </div>
            {addButton}
          </div>
        )}

        {monitors && monitors.length > 0 && (
          <ul className="divide-y rounded-lg border">
            {monitors.map((m) => (
              <MonitorRow
                key={m.id}
                monitor={m}
                busy={busyId === m.id}
                onToggle={() => void toggle(m)}
                onEdit={() => setEditing(m)}
                onDelete={() => setDeleting(m)}
              />
            ))}
          </ul>
        )}
      </main>

      {editing !== null && (
        <MonitorFormDialog
          // Remount per target so the form starts from that monitor's values.
          key={editing === 'new' ? 'new' : editing.id}
          open
          monitor={editing === 'new' ? undefined : editing}
          onOpenChange={(open) => !open && setEditing(null)}
          onSaved={() => void load()}
        />
      )}
      <DeleteMonitorDialog
        monitor={deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        onDeleted={() => void load()}
        onError={setError}
      />
    </div>
  );
}
