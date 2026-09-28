/** "99.8%", or "—" when there's no data. */
export function formatUptime(percent: number | null): string {
  return percent === null ? '—' : `${percent}%`;
}

/** "142 ms", "1.2 s", or "—" when there's no data. */
export function formatLatency(ms: number | null): string {
  if (ms === null) return '—';
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}
