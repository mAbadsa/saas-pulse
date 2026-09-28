# Contract: Stats API

Both routes require a Bearer token (the global guard) and are scoped to the caller.

```ts
export type StatsRange = '24h' | '7d';

export interface MonitorStatsSummary {
  monitorId: string;
  checks: number;               // 0 = no data
  uptimePercent: number | null; // 1 decimal place; null when checks = 0
  avgLatencyMs: number | null;  // mean over checks that got a response; null if none
}

export interface StatsPoint {
  t: string;                    // ISO start of the slot
  checks: number;
  uptimePercent: number | null;
  avgLatencyMs: number | null;  // null = gap
}

export interface CheckResponse {
  id: string;
  checkedAt: string;
  isUp: boolean;
  statusCode: number | null;
  latencyMs: number | null;
  error: string | null;
}

export interface MonitorStatsDetail {
  monitorId: string;
  range: StatsRange;
  bucketSeconds: number;        // 3600 for 24h, 21600 for 7d
  checks: number;
  uptimePercent: number | null;
  avgLatencyMs: number | null;
  series: StatsPoint[];         // oldest first, including empty slots
  recent: CheckResponse[];      // up to 20, newest first
}
```

## GET /monitors/stats

`200 MonitorStatsSummary[]`: one entry per monitor the caller owns, covering the last 24 hours.

## GET /monitors/:id/stats?range=24h|7d

| Case | Status |
|------|--------|
| Owned monitor | 200 `MonitorStatsDetail` (`range` defaults to `24h`) |
| `range` not `24h` or `7d` | 400 |
| Missing, malformed id, or another user's monitor | 404 `Monitor not found` |

## Configuration

| Variable | Default | Effect |
|----------|---------|--------|
| `CHECK_RETENTION_DAYS` | `30` | Checks older than this are deleted hourly. Values under 7 are raised to 7. |
