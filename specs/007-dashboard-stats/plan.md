# Implementation Plan: Dashboard Stats

**Branch**: `007-dashboard-stats` | **Date**: 2026-09-28 | **Spec**: [spec.md](./spec.md)

## Summary

**API.** Add a `StatsService` in `MonitorsModule`, with two endpoints computed by aggregate SQL over `Check`, scoped by `userId`:
- `GET /monitors/stats` returns a 24 h summary for every one of the caller's monitors (one grouped query).
- `GET /monitors/:id/stats?range=24h|7d` returns the period summary, a time series in `date_bin` slots (1 h / 6 h, gaps filled with `generate_series`) and the last 20 checks.

**Retention.** Add a `CheckRetentionService` in `PingModule`: an hourly `setInterval` deletes checks older than `CHECK_RETENTION_DAYS` (default 30, minimum 7). It uses the same `PING_ENABLED` gate as the ping loop.

**Web.**
- The monitors list fetches `/monitors/stats` together with `/monitors` and shows "99.8% · 142 ms" (24 h) per row.
- The monitor name links to a new page, `/monitors/:id?range=24h`, with:
  - stat tiles
  - a Recharts single-series line chart of average latency (blue `--chart-1`, validated with the dataviz script; `connectNulls={false}` so empty slots show as gaps; a crosshair tooltip)
  - a 24 h / 7 d toggle kept in the URL search params
  - a recent-checks list
  - 15 s polling

## Technical Context

- **Stack**: NestJS 11, Prisma 6 (`$queryRaw` for the aggregates), React 19, react-router 7, **Recharts 3 (new dependency)**
- **Storage**: no schema change. Stats use the existing `Check @@index([monitorId, checkedAt])`.
- **Testing**:
  - API e2e tests (`test/stats.e2e-spec.ts`): insert checks with known timestamps and values, then assert the exact uptime, average, series and recent checks; isolation 404; range validation; retention prune
  - Web: lint, build and a manual check
- **Performance**: SC-003 needs 20k checks in under 1 s, covered by one indexed range scan per query. An e2e test seeds 20k checks and times the detail endpoint.
- **Constraints**:
  - every query includes `m."userId" = $userId`
  - a range whitelist through the DTO (`@IsIn(['24h','7d'])`)
  - no string interpolation of the bucket size; it's picked from a constant map and bound as an interval parameter

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Workspace Boundaries | ✅ | `StatsRange`, `MonitorStatsSummary`, `MonitorStatsDetail`, `StatsPoint` and `CheckResponse` go in `packages/shared`. |
| II. Module Structure | ✅ | Stats belong to the monitors feature: `StatsService` goes in `MonitorsModule`, not a new global. Retention goes next to the ping loop in `PingModule`. |
| III. Code Style | ✅ | Lint must pass, both locally and in CI. |
| IV. Data Model | ✅ | No schema change. |
| V. Simplicity | ✅ | Computed on read (no rollup tables or cron aggregation). Retention is a plain `deleteMany`. One chart library, the one the roadmap names. `ponytail:` notes mark the future cutover points (rollups, a `checkedAt` index for retention). |
| VI. Auth & Isolation | ✅ | Both endpoints filter by `userId`. The detail endpoint 404s on a foreign or missing monitor. Two-user e2e tests. The guard-rail test covers the new routes automatically. |

## Project Structure

```text
packages/shared/src/index.ts                 # + stats contracts

apps/api/src/monitors/
├── stats.service.ts                         # summaryForUser(), detail()
├── stats.dto.ts                             # StatsQueryDto { range: '24h' | '7d' = '24h' }
├── monitors.controller.ts                   # + GET stats (before :id) and GET :id/stats
└── monitors.module.ts                       # + StatsService
apps/api/src/ping/
├── check-retention.service.ts               # hourly prune
└── ping.module.ts                           # + CheckRetentionService
apps/api/test/stats.e2e-spec.ts

apps/web/src/
├── index.css                                # --chart-1 → #2a78d6 / #3987e5 (dark)
├── App.tsx                                  # + /monitors/:id route
├── lib/format.ts                            # formatUptime, formatLatency
└── monitors/
    ├── MonitorRow.tsx                       # + 24 h stats line, name links to detail
    ├── MonitorsPage.tsx                     # + fetch /monitors/stats
    ├── MonitorDetailPage.tsx                # header, range toggle, tiles, chart, recent checks
    └── LatencyChart.tsx                     # Recharts LineChart
```

## Complexity Tracking

No violations.
