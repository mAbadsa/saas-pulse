# Research: Dashboard Stats

## 1. Compute on read vs rollups

- **Decision:** aggregate SQL on every request.
- **Rationale:** at 30 s intervals, 7 days is about 20k rows per monitor, read through the existing `(monitorId, checkedAt)` index, so one range scan is fast. Rollup tables would add a schema, a job and consistency issues (Principle V).
- **When to switch** (`ponytail:` comment): if SC-003 regresses or monitors number in the thousands, add hourly rollups.

## 2. Queries

**Summary** (all of the caller's monitors, 24 h):
```sql
SELECT m.id AS "monitorId",
       count(c.id)::int AS checks,
       round(100.0 * count(c.id) FILTER (WHERE c."isUp") / NULLIF(count(c.id), 0), 1)::float AS "uptimePercent",
       round(avg(c."latencyMs"))::int AS "avgLatencyMs"
FROM "Monitor" m
LEFT JOIN "Check" c ON c."monitorId" = m.id AND c."checkedAt" >= now() - interval '24 hours'
WHERE m."userId" = $1
GROUP BY m.id
```
`avg()` ignores the null `latencyMs` of failed checks, as the spec requires. Monitors with no checks come back as `checks = 0` with nulls.

**Series** (one monitor):
```sql
WITH slots AS (
  SELECT generate_series(date_bin($step, now() - $range, 'epoch'), now(), $step) AS t)
SELECT s.t, count(c.id)::int AS checks,
       round(avg(c."latencyMs"))::int AS "avgLatencyMs",
       round(100.0 * count(c.id) FILTER (WHERE c."isUp") / NULLIF(count(c.id),0), 1)::float AS "uptimePercent"
FROM slots s
LEFT JOIN "Check" c ON c."monitorId" = $id
  AND c."checkedAt" >= s.t AND c."checkedAt" < s.t + $step
  AND c."checkedAt" >= now() - $range
GROUP BY s.t ORDER BY s.t
```
`$step` and `$range` are bound as Postgres `interval` parameters (`'1 hour'::interval`) taken from a fixed map, never interpolated. Ownership is checked first with `findOwned` (404).

- **Slot alignment:** `date_bin` against the epoch gives stable, clock-aligned slots (on the hour, and 00/06/12/18 UTC).
- **Slot counts:** 24 h gives 25 slots and 7 d gives 29, because the partial current slot is included.
- **Recent checks:** `prisma.check.findMany({ where: { monitorId }, orderBy: { checkedAt: 'desc' }, take: 20 })`, after the ownership check.

## 3. Route order

- **Decision:** declare `@Get('stats')` before `@Get(':id')` in `MonitorsController`.
- **Rationale:** otherwise `/monitors/stats` would match `:id = 'stats'`.

## 4. Retention

- **Decision:** `CheckRetentionService` in `PingModule`: `setInterval(prune, 1 h)`, plus one run at startup, gated by `PING_ENABLED`. `prune()` runs `prisma.check.deleteMany({ where: { checkedAt: { lt: now - days } } })`, and `CHECK_RETENTION_DAYS` is clamped to at least 7.
- **Rationale:** it has the same lifecycle as the checker. e2e tests call `prune()` directly.
- **Ceiling** (`ponytail:` comment): the delete filters on `checkedAt` alone, which isn't the leading column of the index. That's fine at this scale; add `@@index([checkedAt])` or delete in batches if pruning gets slow.

## 5. Chart

- **Form (dataviz):** change over time for one measure, so a single-series line chart. There's no legend, because the title names the series.
- **Colour:** `--chart-1`, changed to `#2a78d6` light and `#3987e5` dark. Both pass `validate_palette.js`. The neutral grays failed the chroma floor because they read as gridlines.
- **Marks:** a 2 px line with round joins, no dots except the active one, hairline horizontal grid only, and a recessive axis.
- **Gaps:** `connectNulls={false}`, so empty slots break the line. Showing them as 0 ms would be a lie.
- **Interaction:** Recharts `Tooltip` with a cursor line (a crosshair) showing the slot time, average latency, uptime % and check count, in text tokens rather than the series colour.
- **Accessibility:**
  - the chart wrapper has `role="img"` and an `aria-label` that summarises the range and average
  - the period figures appear as stat tiles in text
  - the recent-checks list is the table view of individual results
- **Y-axis:** starts at 0 and is labelled "ms".

## 6. Where the list stats come from

- **Decision:** `MonitorsPage` fetches `/monitors` and `/monitors/stats` in parallel on each poll and joins them by `monitorId`.
- **Rationale:** `MonitorResponse` stays the same everywhere (create and patch responses don't need stats), and it's one extra cheap query.

## 7. Range in the URL

- **Decision:** `useSearchParams`: `?range=7d`, with anything else treated as `24h`.
- **Rationale:** it survives a reload and can be shared (spec US2-3).
