# Phase 1: Data Model & Event Schemas

**Date**: 2026-09-30  
**Feature**: Live Dashboard Updates

## Overview

This feature does not introduce new database tables. All data is derived from existing `Monitor`, `Check`, and `User` entities. Socket.io events are ephemeral (not persisted) and carry snapshots of current state.

## Existing Entities (Leveraged)

### Monitor

**Attributes**:
- `id` (UUID): Unique identifier
- `userId` (UUID): Owner (tenant isolation)
- `name` (string): Display name
- `url` (string): Target URL
- `status` (enum): `PENDING` | `UP` | `DOWN`
- `isActive` (boolean): Pause/resume flag
- `lastCheckedAt` (datetime): Latest check timestamp

**Used by Feature**:
- Events emit monitor `id`, `status`, and `userId` for real-time updates
- Real-time status updates triggered when `Monitor.status` changes (via `PingService.recordResult()`)

---

### Check

**Attributes**:
- `id` (UUID): Unique identifier
- `monitorId` (UUID): Foreign key to Monitor
- `isUp` (boolean): Pass/fail
- `statusCode` (int nullable): HTTP status if available
- `latencyMs` (int nullable): Round-trip time
- `error` (string nullable): Error message if failed
- `checkedAt` (datetime): When check was performed

**Used by Feature**:
- Stat updates (24h uptime %, 24h avg latency) are computed from Check records
- Events emit aggregated stats for display on dashboard

---

### User

**Attributes**:
- `id` (UUID): Unique identifier
- Other fields not relevant for real-time updates

**Used by Feature**:
- Socket.io events scoped by user: only emit to the authenticated user
- Room naming: `user:{id}`

---

## Socket.io Event Schemas

Events are defined in `packages/shared/src/socket-events.ts` (new file, shared between API and web).

### Event 1: Monitor Status Changed

**Event Name**: `monitor:status-change`

**Payload**:
```typescript
interface MonitorStatusChangeEvent {
  monitorId: string;        // UUID of the monitor
  status: 'UP' | 'DOWN' | 'PENDING';
  timestamp: number;        // Server time (ms since epoch) for ordering
  userId: string;           // Implicit (used for room routing); not sent to client
}
```

**When Emitted**:
- After `PingService.recordResult()` updates `Monitor.status`
- Only if status changed (no duplicate events for same status)

**Client Side**:
- Received by web app via `socket.on('monitor:status-change', (event) => { /* update UI */ })`
- Used to update status badge color, icon, text

---

### Event 2: Monitor Stats Updated

**Event Name**: `monitor:stats-update`

**Payload**:
```typescript
interface MonitorStatsUpdateEvent {
  monitorId: string;        // UUID of the monitor
  uptime24h: number;        // Percentage (0-100)
  latency24hAvg: number;    // Milliseconds
  latency24hMin: number;    // Min latency (for sparkline if added later)
  latency24hMax: number;    // Max latency (for sparkline if added later)
  timestamp: number;        // Server time (ms since epoch)
  userId: string;           // Implicit; not sent to client
}
```

**When Emitted**:
- After `PingService.recordResult()` and stats are recomputed
- On every new check (stats change incrementally)

**Client Side**:
- Received via `socket.on('monitor:stats-update', (event) => { /* update tiles */ })`
- Used to update uptime % and latency tiles on monitor row and detail page

---

## State Transitions & Idempotency

### Status Change Idempotency

**Problem**: Out-of-order delivery or network duplicates could cause the same status update to arrive twice.

**Solution**: Client-side deduplication key = `monitorId + timestamp`.
- Store latest seen `timestamp` for each monitor
- Only process event if `event.timestamp > lastSeenTimestamp[monitorId]`

**Example**:
```typescript
const lastSeenTimestamp = useRef<Record<string, number>>({});

socket.on('monitor:status-change', (event) => {
  if (event.timestamp > (lastSeenTimestamp.current[event.monitorId] || 0)) {
    lastSeenTimestamp.current[event.monitorId] = event.timestamp;
    // Update UI
  }
});
```

---

### Stats Update Idempotency

**Problem**: Stat updates may lag behind status changes; multiple stats updates for same monitor are possible.

**Solution**: Same as status (deduplication by timestamp). Additionally, stats are monotonic (never go backward in time), so latest timestamp always wins.

---

## State Sync on Reconnection

**Problem**: User goes offline, multiple state changes happen, user comes back online. What's the current state?

**Solution**: Web app does NOT rely on queued events. Instead:
1. Socket.io reconnects
2. Web app immediately fetches current state via `GET /monitors` (existing API call)
3. Dashboard refreshes with latest data
4. Resume listening to real-time events

**Implementation** (in `useMonitorUpdates` hook):
```typescript
socket.on('reconnect', () => {
  // Full sync: fetch latest state from API
  fetchMonitors(); // Existing call
});
```

---

## Event Retention & Broadcast Scope

**Retention**: No persistence. Events are fire-and-forget; if a client isn't connected, it misses the event.

**Broadcast Scope**: All events scoped to `user:{userId}` room. Only authenticated users receive events for their own monitors.

**Example** (server side):
```typescript
io.to(`user:${userId}`).emit('monitor:status-change', {
  monitorId: '123-abc',
  status: 'UP',
  timestamp: Date.now(),
  userId: userId, // For reference only
});
```

---

## Database Queries (No Changes)

All queries remain in existing services (`MonitorsService`, `PingService`). No new queries introduced; events emit after existing queries complete.

**Query Pattern** (existing):
```typescript
// apps/api/src/monitors/stats.service.ts
// Already computes uptime % and latency from Check records
// No schema changes needed
```

---

## Performance Considerations

### Stat Computation

Current: Stats computed on-read (GET /monitors/stats). Doesn't scale well to 1000s of monitors.

For this feature: Stats computed on-write (after each check recorded). Emitted immediately to reduce client latency.

**Trade-off**: Slightly more CPU on write (each check recalculates for a monitor). Benefit: Instant stat updates, no client-side polling for stats.

**Ceiling** (YAGNI):
```
// Ponytail: Stat computation on write (expensive if 10k+ monitors per user). 
// If latency becomes issue, pre-aggregate into 5m/1h buckets; emit aggregates instead of per-check.
```

---

## Validation Rules (Inherited)

No new validation. All event payloads use existing entity constraints:
- `monitorId`: Must exist and belong to the authenticated user (enforced on emit)
- `status`: Enum values from `MonitorStatus`
- `uptime24h`: 0–100 (percentage)
- `latency24hAvg`: >= 0 (milliseconds)
- `timestamp`: Server-generated, cannot be spoofed by client

---

## Summary Table

| Entity | Used For | Impact |
|--------|----------|--------|
| Monitor | Status change events, room scoping | No schema change |
| Check | Stat computation (uptime %, latency) | No schema change |
| User | Auth, room assignment | No schema change |

No new tables. No migrations. All logic in application layer (Socket.io Gateway + React hooks).
