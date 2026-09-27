# Data Model: Ping Service

No schema change.

## Check (existing), written once per completed check

| Field | Up (2xx/3xx) | Down (4xx/5xx) | Down (timeout / network / blocked) |
|-------|--------------|----------------|------------------------------------|
| `isUp` | true | false | false |
| `statusCode` | code | code | null |
| `latencyMs` | ms to headers | ms to headers | null |
| `error` | null | null | message, ≤ 500 characters |
| `checkedAt` | now | now | now |

## Monitor (existing), updated after each saved check

| Field | Change |
|-------|--------|
| `status` | `UP` if `isUp`, else `DOWN` |
| `lastCheckedAt` | the time of the check |

The update applies only `WHERE id = :id AND url = :checkedUrl`. If no row matches (deleted, or URL changed), the result is discarded and no `Check` row is written.

## When a monitor is due

`isActive AND (lastCheckedAt IS NULL OR lastCheckedAt + intervalSeconds <= now())`
