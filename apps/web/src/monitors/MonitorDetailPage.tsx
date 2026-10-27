import type {
  MonitorResponse,
  MonitorStatsDetail,
  StatsRange,
} from '@saas-pulse/shared';
import { ArrowLeft, CheckCircle2, RefreshCw, XCircle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { api, ApiError } from '@/lib/api';
import { formatLatency, formatUptime } from '@/lib/format';
import { relativeTime } from '@/lib/time';
import { useMonitorUpdates } from '@/hooks/useMonitorUpdates';
import { LatencyChart } from './LatencyChart';
import { StatusBadge } from './StatusBadge';

const REFRESH_MS = 15_000;
const RANGE_LABEL: Record<StatsRange, string> = {
  '24h': 'Last 24 hours',
  '7d': 'Last 7 days',
};

export function MonitorDetailPage() {
  const { id = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const range: StatsRange = params.get('range') === '7d' ? '7d' : '24h';

  const [monitor, setMonitor] = useState<MonitorResponse | null>(null);
  const [stats, setStats] = useState<MonitorStatsDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // State only set in promise callbacks: load() runs from an effect.
  const load = useCallback(
    () =>
      Promise.all([
        api<MonitorResponse>(`/monitors/${id}`),
        api<MonitorStatsDetail>(`/monitors/${id}/stats?range=${range}`),
      ])
        .then(([m, s]) => {
          setMonitor(m);
          setStats(s);
          setError(null);
        })
        .catch((err: unknown) => {
          if (!(err instanceof ApiError) || err.status === 401) return;
          if (err.status === 404) setNotFound(true);
          else setError(err.messages.join(' '));
        }),
    [id, range],
  );

  // Real-time monitor updates via Socket.io
  useMonitorUpdates((update) => {
    if (update.monitorId !== id) return; // Only listen to this monitor's updates

    if (update.type === 'status' && monitor) {
      // Update monitor status instantly
      const statusEvent = update.data as import('@saas-pulse/shared').MonitorStatusChangeEvent;
      setMonitor({ ...monitor, status: statusEvent.status });
    } else if (update.type === 'stats' && stats) {
      // Update stats (note: this is just the summary; full stats via polling)
      // In a more complete impl, we'd append new checks to the recent list
      const statsEvent = update.data as import('@saas-pulse/shared').MonitorStatsUpdateEvent;
      setStats({
        ...stats,
        uptimePercent: statsEvent.uptime24h,
        avgLatencyMs: statsEvent.latency24hAvg,
      });
    }
  });

  useEffect(() => {
    void load();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  const backLink = (
    <Link
      to="/"
      className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
    >
      <ArrowLeft aria-hidden className="size-4" />
      All monitors
    </Link>
  );

  if (notFound) {
    return (
      <main className="mx-auto flex max-w-4xl flex-col items-start gap-3 px-4 py-10">
        {backLink}
        <h1 className="text-2xl font-semibold">Monitor not found</h1>
        <p className="text-muted-foreground">
          It may have been deleted, or it belongs to another account.
        </p>
      </main>
    );
  }

  const hasData = stats !== null && stats.checks > 0;
  const summary = hasData
    ? `Average response time per ${range === '24h' ? 'hour' : '6 hours'}, ${RANGE_LABEL[range].toLowerCase()}. Overall average ${formatLatency(stats.avgLatencyMs)}, uptime ${formatUptime(stats.uptimePercent)}.`
    : `No checks in the ${RANGE_LABEL[range].toLowerCase()}.`;

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-6">
      {backLink}

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

      {!monitor ? (
        !error && (
          <p className="text-muted-foreground" aria-busy="true">
            Loading monitor…
          </p>
        )
      ) : (
        <>
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-semibold" title={monitor.name}>
                {monitor.name}
              </h1>
              <p className="text-muted-foreground truncate text-sm" title={monitor.url}>
                {monitor.url}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                <StatusBadge monitor={monitor} />
                <span className="text-muted-foreground">
                  Checked {relativeTime(monitor.lastCheckedAt).toLowerCase()} · every{' '}
                  {monitor.intervalSeconds}s
                </span>
              </div>
            </div>
            <div role="group" aria-label="Time range" className="flex gap-1">
              {(['24h', '7d'] as const).map((r) => (
                <Button
                  key={r}
                  size="sm"
                  variant={r === range ? 'default' : 'outline'}
                  aria-pressed={r === range}
                  onClick={() => setParams({ range: r }, { replace: true })}
                >
                  {r === '24h' ? '24 hours' : '7 days'}
                </Button>
              ))}
            </div>
          </header>

          <section aria-label="Summary" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              { label: 'Uptime', value: formatUptime(stats?.uptimePercent ?? null) },
              { label: 'Avg latency', value: formatLatency(stats?.avgLatencyMs ?? null) },
              { label: 'Checks', value: stats ? String(stats.checks) : '—' },
            ].map((tile) => (
              <Card key={tile.label} size="sm">
                <CardHeader>
                  <CardDescription>{tile.label}</CardDescription>
                  <CardTitle className="text-2xl tabular-nums">{tile.value}</CardTitle>
                </CardHeader>
              </Card>
            ))}
          </section>

          <Card>
            <CardHeader>
              <CardTitle>Response time</CardTitle>
              <CardDescription>
                {RANGE_LABEL[range]}, average per {range === '24h' ? 'hour' : '6 hours'}. Gaps
                mean no response in that period.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {stats && hasData ? (
                <LatencyChart series={stats.series} range={range} summary={summary} />
              ) : (
                <p className="text-muted-foreground py-10 text-center text-sm">{summary}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent checks</CardTitle>
              <CardDescription>The 20 most recent results, newest first.</CardDescription>
            </CardHeader>
            <CardContent>
              {stats?.recent.length ? (
                <ul className="divide-y">
                  {stats.recent.map((c) => (
                    <li
                      key={c.id}
                      className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm"
                    >
                      {c.isUp ? (
                        <Badge
                          variant="outline"
                          className="border-green-600/30 text-green-600 dark:text-green-400"
                        >
                          <CheckCircle2 aria-hidden />
                          Up
                        </Badge>
                      ) : (
                        <Badge variant="destructive">
                          <XCircle aria-hidden />
                          Down
                        </Badge>
                      )}
                      <time dateTime={c.checkedAt} className="text-muted-foreground w-28">
                        {relativeTime(c.checkedAt)}
                      </time>
                      <span className="tabular-nums">
                        {c.statusCode ?? '—'}
                        {c.latencyMs !== null && ` · ${formatLatency(c.latencyMs)}`}
                      </span>
                      {c.error && (
                        <span className="text-destructive w-full break-words text-xs sm:w-auto">
                          {c.error}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground text-sm">No checks yet.</p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </main>
  );
}
