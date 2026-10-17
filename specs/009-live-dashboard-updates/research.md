# Phase 0: Research & Design Decisions

**Date**: 2026-09-30  
**Feature**: Live Dashboard Updates (Socket.io real-time)

## Overview

This feature adds Socket.io-based real-time updates to replace the 15-second polling mechanism on the monitors dashboard. All design decisions are grounded in the project's existing architecture, YAGNI principle, and early-stage SaaS context.

## Key Design Decisions

### 1. Socket.io for Real-Time Transport

**Decision**: Use Socket.io (already planned in CLAUDE.md) for server-to-client real-time events.

**Rationale**:
- Built-in reconnection logic (handles network drops transparently)
- Auto-fallback to HTTP long-polling (matches our fallback requirement)
- Mature library for Node.js + browser; widely used in production SaaS
- Integrates well with NestJS via @nestjs/websockets

**Alternatives Considered**:
- WebSocket directly: No built-in fallback; would require custom polling layer (more code)
- Server-Sent Events (SSE): Unidirectional; would still need polling for client → server (e.g., pause/resume monitor). Socket.io handles both directions elegantly.
- Polling only: Simpler, but doesn't meet the 500ms real-time requirement; 15s delay is the current pain point

**Upgrade Path**: If message queue (RabbitMQ, Kafka) is added for event distribution, Socket.io Gateway remains the same; only the source of events changes.

---

### 2. NestJS Gateway Module Structure

**Decision**: Create a single `SocketModule` with `SocketGateway` (handles WebSocket connections) and `SocketService` (emits events to clients).

**Rationale**:
- One module per feature aligns with Constitution Section II
- Gateway handles connection/disconnection lifecycle and auth
- Service handles event emission; injected into `PingService` and `MonitorsService`
- Keeps Socket.io logic colocated and testable
- No need for `@Global()` decorator (Constitution Section II forbids workarounds)

**Module Injection Points**:
- `PingService.recordResult()` calls `socketService.emitStatUpdate()`
- `MonitorsService` status changes call `socketService.emitStatusChange()`

---

### 3. User-Scoped Events via Socket.io Rooms

**Decision**: Use Socket.io "rooms" to scope events to the authenticated user. Each user joins a room (e.g., `user:123`) on connect.

**Rationale**:
- Prevents cross-user data leaks (Constitution Section VI: auth & tenant isolation)
- Emit logic: `io.to(`user:${userId}`).emit('monitor:status-change', event)`
- Clean, built-in mechanism; no custom filtering needed
- Rooms are ephemeral; no persistence (YAGNI)

**Alternative**: Namespace per user (`/user/123`). Rejected because rooms are simpler; namespaces would require more plumbing for the same isolation guarantee.

---

### 4. Event Schemas & Timestamps

**Decision**: All Socket.io events include a `timestamp` (server time) and monitor `id` for client-side deduplication and ordering.

**Rationale**:
- Out-of-order delivery is possible on unreliable networks; timestamp ensures latest state wins
- Idempotency key (monitor ID + timestamp) prevents duplicate UI updates
- Matches common real-time system patterns (e.g., Figma, Slack)

**Event Types**:
```
StatusChangeEvent: { monitorId, userId, status, timestamp }
StatUpdateEvent: { monitorId, userId, uptime24h, latency24h, timestamp }
```

---

### 5. Graceful Fallback to Polling

**Decision**: Socket.io client library handles fallback automatically. Web app does not need custom logic for this.

**Rationale**:
- Socket.io client library emits `disconnect` event if connection fails
- React hook (`useMonitorUpdates`) detects disconnect, re-enables polling
- Polling resumes within 1s (spec requirement SC-004)
- No special error handling needed; fallback is transparent

**Implementation**:
```typescript
// In useMonitorUpdates hook
socket.on('disconnect', () => {
  // Resume polling until reconnected
  enablePolling();
});

socket.on('connect', () => {
  disablePolling();
});
```

---

### 6. Connection Lifecycle: Page Load → Unmount

**Decision**: Create a `useSocket()` hook that establishes connection on component mount, disconnects on unmount or tab hide.

**Rationale**:
- React best practice (useEffect cleanup)
- Prevents resource leaks (open sockets when user leaves monitors page)
- Tab visibility API (`document.hidden`) allows graceful pause/resume
- Spec requirement FR-001: "close it on unmount"

**Implementation**:
```typescript
export function useSocket() {
  const [socket, setSocket] = useState(null);
  
  useEffect(() => {
    const sock = io('/');
    setSocket(sock);
    
    const handleVisibility = () => {
      if (document.hidden) sock.disconnect();
      else sock.connect();
    };
    
    document.addEventListener('visibilitychange', handleVisibility);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      sock.disconnect();
    };
  }, []);
  
  return socket;
}
```

---

### 7. Server-Side Auth on Socket Connection

**Decision**: Middleware on Socket.io connection validates JWT token from query params or handshake headers.

**Rationale**:
- Every Socket.io connection requires a valid Bearer token (Constitution Section VI)
- Token verification via `JwtService` (existing, reusable)
- If token invalid or expired, connection is rejected (401-like)
- No token parsing in handlers; use `@CurrentUser()` guard equivalent for sockets

**Implementation**:
```typescript
@WebSocketGateway()
export class SocketGateway implements OnGatewayConnection {
  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth.token;
      const user = await this.jwtService.verify(token);
      client.join(`user:${user.id}`);
    } catch {
      client.disconnect();
    }
  }
}
```

---

### 8. No New Database Schema

**Decision**: Events are ephemeral; no persistence of Socket.io messages. All data already exists in `Monitor`, `Check`, `User` tables.

**Rationale**:
- YAGNI: Event persistence is not required for real-time dashboard updates
- Events are derived from existing data (status from `Monitor`, stats from `Check` aggregations)
- Simplifies implementation; no migration needed
- Future: If audit log or event replay is needed, add event table then

---

## Testing Strategy

### API (Socket.io Gateway)

**Unit Tests**:
- Socket connection with valid token → user joined to correct room
- Socket connection with invalid token → connection rejected
- Status change event emitted → only user's room receives it

**E2E Tests**:
- Two users connected → User A sees their monitor updates, not User B's
- Monitor status changes → event emitted within 500ms
- Connection drops → auto-reconnects and syncs state
- Session expires → socket disconnected, user signed out

### Web (React)

**Manual Validation** (no test runner yet):
- Open monitors page → Socket.io tab in DevTools shows "connected"
- Monitor status changes (trigger via API call or test ping) → status badge updates within 500ms
- Switch browser tab → Socket.io shows "disconnect"
- Switch back → reconnects, dashboard syncs
- Disable Socket.io on server → fallback to polling resumes

---

## Deployment & Rollback

**Safe Rollout**:
1. Deploy Socket.io Gateway (feature flag: `SOCKET_IO_ENABLED`, default false)
2. Deploy React changes (graceful degradation; fallback to polling always works)
3. Enable `SOCKET_IO_ENABLED=true` on staging first
4. Verify e2e tests pass, manual smoke tests
5. Roll out to production with feature flag
6. Monitor: check connection counts, event latency, error rates
7. If needed, rollback by disabling feature flag (no database migration to undo)

---

## Performance & Scalability

**Current Design Performance**:
- Latency: WebSocket ≈ 10ms round-trip (local network); total: ~500ms with message processing ✅
- Connections: NestJS + Node.js default settings support thousands of concurrent connections
- Memory: Socket.io stores one connection object per client (~1KB each); negligible for team SaaS scale

**Scaling Notes**:
- If 10k+ concurrent users needed: add Redis adapter for Socket.io (multi-server pub/sub)
- If event audit log needed: add `SocketEvent` table (append-only, no complex schema)
- Current YAGNI: single-server deployment sufficient for early stage

**Ponytail Comment** (marking the ceiling):
```typescript
// Ponytail: single-server Socket.io. Multi-server needs Redis adapter (`@socket.io/redis-adapter`) 
// if 1000+ concurrent connections. Audit log needs SocketEvent table if required later.
```

---

## Open Questions (None)

All clarifications from the spec have been resolved:
- ✅ Socket.io chosen as transport
- ✅ Event schema and timestamps defined
- ✅ User isolation via rooms decided
- ✅ Fallback mechanism understood (automatic via Socket.io client)
- ✅ Connection lifecycle determined (React hooks, tab visibility)
