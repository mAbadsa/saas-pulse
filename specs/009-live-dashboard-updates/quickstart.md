# Phase 1: Quickstart & Validation

**Date**: 2026-09-30  
**Feature**: Live Dashboard Updates (Socket.io real-time)

## Overview

This guide provides end-to-end validation scenarios to prove the feature works as specified. No implementation code is included; this is a testing/demo runbook.

## Prerequisites

- Local development environment running (see CLAUDE.md: `npm run db:up`, `npm run dev:api`, `npm run dev:web`)
- PostgreSQL and Redis running on Docker (docker-compose.yml)
- Node.js 18+, npm
- Browser with DevTools (Chrome, Firefox, Safari all supported)

## Scenario 1: Real-Time Status Update (P1)

**Goal**: Verify monitor status updates appear instantly on dashboard without page refresh.

**Setup**:
1. Start API: `npm run dev:api`
2. Start web: `npm run dev:web`
3. Open browser: http://localhost:5173/monitors
4. Sign in (or create account)
5. Create a test monitor: name "Test Example", URL "https://example.com"

**Procedure**:
1. Open DevTools (F12) → Network tab → Filter: "socket.io"
2. Verify Socket.io connection established (should see WebSocket messages)
3. Trigger a status change:
   - Option A: Wait for next automatic ping (~10 seconds; status will update)
   - Option B: Via API (use curl or Postman): `POST /monitors/{id}/test` (if endpoint exists, or manually call ping service)
4. Observe monitor row: status badge changes color (UP ↔ DOWN)
5. **Verify**: Status updates within 500ms of the event being recorded (check timestamp in DevTools console)

**Expected Result**: ✅ Status badge updates instantly; no page reload needed.

---

## Scenario 2: Connection Lifecycle (P2)

**Goal**: Verify Socket.io connects on page load and disconnects on unmount/tab hide.

**Setup**: Same as Scenario 1

**Procedure**:
1. Open DevTools → Console
2. Run: `console.log(document.querySelector('socket.io').connected)` (or inspect Socket.io debug logs)
3. Monitor socket events:
   ```javascript
   // Paste into DevTools console to log all socket events
   if (window.socket) {
     ['connect', 'disconnect', 'connect_error'].forEach(evt => {
       window.socket.on(evt, () => console.log(`Socket event: ${evt}`));
     });
   }
   ```
4. Close DevTools (don't close browser)
5. Navigate to a different page (e.g., `/login`, or outside the app)
6. Observe console: "Socket event: disconnect"
7. Navigate back to `/monitors`
8. Observe console: "Socket event: connect"

**Expected Result**: ✅ Socket connects on page load, disconnects when user leaves; no resource leaks.

---

## Scenario 3: Tab Visibility (P2 Extended)

**Goal**: Verify Socket.io pauses when tab is hidden and resumes when visible.

**Setup**: Same as Scenario 1

**Procedure**:
1. Open two tabs: Tab A (monitors page), Tab B (any other site)
2. Open DevTools on Tab A → Console
3. Run socket event logger (see Scenario 2)
4. Switch to Tab B
5. Wait 2 seconds
6. Observe Tab A console (if still visible): "Socket event: disconnect" (or logs paused)
7. Switch back to Tab A
8. Observe console: "Socket event: connect" (or logs resumed)

**Expected Result**: ✅ Socket pauses on tab hide, resumes on tab show; reduces bandwidth when user isn't looking.

---

## Scenario 4: Stats Update (P2)

**Goal**: Verify uptime % and latency tiles update in real-time.

**Setup**: Same as Scenario 1; monitor should have at least 2-3 checks recorded

**Procedure**:
1. On monitors page, observe uptime % tile for the test monitor (e.g., "98.5% - 24h")
2. Trigger a ping/check (same as Scenario 1, step 3)
3. After check completes (few seconds):
   - Observe uptime % and latency tiles refresh
   - No page reload happens
4. Note the timestamp in DevTools network tab; verify tile update happens within 500ms

**Expected Result**: ✅ Stat tiles (uptime %, latency) update without page reload.

---

## Scenario 5: Graceful Fallback to Polling (P3)

**Goal**: Verify app falls back to polling if Socket.io is unavailable.

**Setup**: Same as Scenario 1

**Procedure**:
1. On monitors page with Socket.io connected
2. Open DevTools → Network tab
3. Manually disable Socket.io on server (requires code change or feature flag; for now, simulate by closing connection):
   ```javascript
   // In DevTools console on web app tab
   if (window.socket) window.socket.disconnect();
   ```
4. Observe: Status updates stop appearing (no socket events)
5. Open DevTools → Console → Run:
   ```javascript
   console.log('Polling should resume now...');
   // Wait 15 seconds; monitor row should still update
   ```
6. After 15 seconds, trigger another check (Scenario 1, step 3)
7. Verify monitor row updates (via polling, not socket event)

**Expected Result**: ✅ App gracefully falls back to polling; users see updates (delayed but functional).

---

## Scenario 6: Multi-User Isolation (Auth & Tenant)

**Goal**: Verify User A cannot see User B's monitor updates.

**Setup**: 
1. Create two user accounts (or use two browser profiles)
2. User A: Login, create monitor "API Health"
3. User B: Login (different account), create monitor "Database Health"

**Procedure**:
1. Open two browser windows (incognito windows recommended to avoid session mix):
   - Window A: http://localhost:5173/monitors (logged in as User A)
   - Window B: http://localhost:5173/monitors (logged in as User B)
2. In Window A console, log socket events (Scenario 2 code)
3. In Window B console, do the same
4. Trigger a status change for User B's monitor (in Window B)
5. Observe Window A console: NO socket event (should remain empty or show only own events)
6. Observe Window B console: status change event appears

**Expected Result**: ✅ User A does not see User B's events (tenant isolation enforced).

---

## Scenario 7: Out-of-Order Delivery (Edge Case)

**Goal**: Verify app handles events arriving out of order (timestamp deduplication).

**Setup**: Requires manual socket event injection (advanced)

**Procedure** (manual via DevTools):
1. On monitors page with active Socket.io
2. Manually inject two events in reverse order:
   ```javascript
   if (window.monitorUpdateHandler) {
     // Simulate event arriving out of order
     const event1 = { monitorId: '123', status: 'DOWN', timestamp: 1000 };
     const event2 = { monitorId: '123', status: 'UP', timestamp: 2000 };
     
     // Emit event2 first (newer)
     window.monitorUpdateHandler(event2);
     
     // Then emit event1 (older) - should be ignored
     window.monitorUpdateHandler(event1);
     
     console.log('Final status should be UP (event2 won)');
   }
   ```
3. Verify UI shows "UP" (latest timestamp, not event1)

**Expected Result**: ✅ App uses timestamp to ignore older events; latest state wins.

---

## Scenario 8: Network Reconnection (Edge Case)

**Goal**: Verify app syncs full state after going offline and coming back.

**Setup**: Same as Scenario 1

**Procedure** (simulated offline):
1. On monitors page, note current uptime % for a monitor
2. Open DevTools → Network → Throttle to "Offline"
3. Wait 5 seconds (simulating offline)
4. In a terminal, manually update a monitor status via API:
   ```bash
   curl -X PATCH http://localhost:3000/monitors/{id} \
     -H "Authorization: Bearer {token}" \
     -H "Content-Type: application/json" \
     -d '{"isActive": false}'
   ```
5. Switch DevTools Network back to "No throttling"
6. Socket.io auto-reconnects
7. Observe: Dashboard should refresh to show the state change (offline updates synced)

**Expected Result**: ✅ After reconnection, app fetches latest state; no stale data displayed.

---

## Performance Validation

### Latency Check

**Goal**: Verify real-time updates reach client within 500ms.

**Procedure**:
1. Open DevTools → Performance tab
2. Start recording
3. Trigger a status change (Scenario 1, step 3)
4. Stop recording after 1 second
5. Examine timeline: Socket event received → React state update → DOM update
6. Total time should be < 500ms (excluding network latency)

**Expected Result**: ✅ Event processed within 500ms (performance budget met).

---

### Connection Count Check

**Goal**: Verify no socket leaks (connection left open after unmount).

**Procedure**:
1. Open DevTools → Application → Local Storage (or browser dev tools equivalent)
2. Note number of Socket.io connections (can check Network tab for WebSocket count)
3. Navigate to monitors page → uptime and latency should show 1 connection
4. Navigate away → connection should close
5. Repeat 5 times
6. Verify final connection count is 0 (no leaks)

**Expected Result**: ✅ No open connections left after unmount.

---

## Testing Checklist

Run these scenarios in order. All must pass for feature to be considered done.

- [ ] Scenario 1: Real-time status updates (P1, CRITICAL)
- [ ] Scenario 2: Connection lifecycle (P2)
- [ ] Scenario 3: Tab visibility (P2 extended)
- [ ] Scenario 4: Stats updates (P2)
- [ ] Scenario 5: Graceful fallback (P3)
- [ ] Scenario 6: Multi-user isolation (Security)
- [ ] Scenario 7: Out-of-order delivery (Edge case)
- [ ] Scenario 8: Network reconnection (Edge case)
- [ ] Performance: Latency < 500ms (Spec SC-001)
- [ ] Performance: No socket leaks (Spec SC-005)

---

## Troubleshooting

### Socket.io connection fails

**Symptom**: DevTools shows "connect_error", connection never established

**Check**:
1. API running? (`npm run dev:api` should show "listening on 3000")
2. JWT token valid? Sign out and sign back in
3. CORS origin correct? Check `CORS_ORIGIN` env var in API (default: http://localhost:5173)
4. WebSocket ports open? Firewall not blocking port 3000

### No stats updates appearing

**Symptom**: Uptime % and latency tiles don't update

**Check**:
1. Ping service running? (`PING_ENABLED` should be true; check API logs for "Ping service started")
2. Checks being recorded? Query: `SELECT COUNT(*) FROM "Check" WHERE "checkedAt" > now() - interval '5 minutes'`
3. Socket event emitted? Check API logs for "Stat update event"

### Fallback polling doesn't resume

**Symptom**: Status doesn't update after disabling Socket.io

**Check**:
1. `useMonitorUpdates` hook calling `enablePolling()` on disconnect? (Implementation detail)
2. Polling interval correct? Should be 15 seconds (check `MonitorsPage.tsx`)
3. Check server logs for polling requests: `GET /monitors` should appear every 15s

---

## Notes for QA / Walkthrough

- Feature is backward-compatible: existing polling still works
- Socket.io is a transport layer; all existing API contracts unchanged
- Feature can be enabled/disabled via feature flag (`SOCKET_IO_ENABLED` env var, set during deployment)
- No new database migrations; all data already exists
- Manual testing recommended (no automated web test runner yet)
- DevTools inspection required for connection/event verification

---

## Done Criteria (Feature Acceptance)

✅ All 8 scenarios pass  
✅ Performance targets met (500ms latency, no leaks)  
✅ Multi-user isolation verified  
✅ E2E tests pass (socket.e2e-spec.ts in API)  
✅ Code review complete  
✅ Merged to main  
