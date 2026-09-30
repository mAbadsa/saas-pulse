# Tasks: Live Dashboard Updates (Socket.io Real-Time)

**Input**: Design documents from `/specs/009-live-dashboard-updates/`

**Prerequisites**: plan.md (tech stack: NestJS 11, React 19, Socket.io 4.x), spec.md (4 user stories, P1-P3), research.md (design decisions), data-model.md (event schemas)

**Tests**: E2E tests included (Jest for API, manual for web). Tests are CRITICAL for multi-user isolation and auth validation.

**Organization**: Tasks organized by user story to enable independent implementation, testing, and deployment of each story.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Scaffold Socket.io module structure and shared type definitions

- [ ] T001 Create Socket.io module structure in `apps/api/src/socket/` directory
- [ ] T002 [P] Create shared Socket.io event types in `packages/shared/src/socket-events.ts` with `MonitorStatusChangeEvent` and `MonitorStatsUpdateEvent` interfaces (from contracts/socket-events.ts)
- [ ] T003 [P] Create React Socket.io hooks directory structure in `apps/web/src/hooks/`
- [ ] T004 Initialize Socket.io client utility in `apps/web/src/lib/socket-client.ts` (connection initialization, token auth, fallback handling)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core Socket.io infrastructure that blocks all user story work

**⚠️ CRITICAL**: No user story work can begin until Phase 2 is complete. All tasks below must succeed.

- [ ] T005 Create `SocketGateway` class in `apps/api/src/socket/socket.gateway.ts` with `@WebSocketGateway()` decorator and connection middleware for JWT auth
- [ ] T006 Implement `handleConnection()` to validate JWT token from handshake, extract user ID, and join user-scoped room (`user:{userId}`)
- [ ] T007 Implement `handleDisconnect()` to clean up room membership on disconnect
- [ ] T008 Create `SocketService` in `apps/api/src/socket/socket.service.ts` with injectable `Socket.IO` server instance
- [ ] T009 Implement `emitStatusChange(userId, monitorId, status, timestamp)` method in `SocketService` that emits to `user:{userId}` room
- [ ] T010 Implement `emitStatUpdate(userId, monitorId, uptime24h, latency24hAvg, latency24hMin, latency24hMax, timestamp)` method in `SocketService` that emits to `user:{userId}` room
- [ ] T011 Create `SocketModule` in `apps/api/src/socket/socket.module.ts` with `SocketGateway` and `SocketService` providers
- [ ] T012 Register `SocketModule` in `apps/api/src/app.module.ts` (import SocketModule)
- [ ] T013 Create E2E test file `apps/api/test/socket.e2e-spec.ts` with multi-user isolation tests and auth validation tests (tests must FAIL before implementation is complete)
- [ ] T014 [P] Create `useSocket()` hook in `apps/web/src/hooks/useSocket.ts` that initializes Socket.io client on mount, handles connect/disconnect events, manages visibility state
- [ ] T015 [P] Add tab visibility listener to `useSocket()` hook: disconnect on tab hide, reconnect on tab show
- [ ] T016 Create `useMonitorUpdates()` hook in `apps/web/src/hooks/useMonitorUpdates.ts` that listens to Socket.io events and updates local state

**Checkpoint**: Foundation ready - user stories can now proceed in parallel

---

## Phase 3: User Story 1 - Real-Time Status Updates (Priority: P1) 🎯 MVP

**Goal**: Monitor status changes (UP/DOWN) appear on dashboard within 500ms of server state change

**Independent Test**: Can be tested in isolation by triggering a status change and verifying dashboard updates without page reload

### E2E Tests for User Story 1

- [ ] T017 [P] [US1] Write E2E test `apps/api/test/socket.status-change.e2e-spec.ts`: Monitor status change event emitted to correct user's room only (multi-user isolation)
- [ ] T018 [P] [US1] Write E2E test: Status event includes timestamp, monitorId, status fields as per schema
- [ ] T019 [P] [US1] Write E2E test: Verify idempotency (same event with same timestamp processed only once by client)

### Implementation for User Story 1

- [ ] T020 [US1] Modify `apps/api/src/monitors/monitors.service.ts`: After monitor status changes, call `socketService.emitStatusChange(userId, monitorId, newStatus, Date.now())`
- [ ] T021 [US1] Modify `apps/api/src/ping/ping.service.ts` in `recordResult()` method: After updating `Monitor.status`, emit status change event via `socketService.emitStatusChange()`
- [ ] T022 [US1] Create state management for real-time updates in `apps/web/src/hooks/useMonitorUpdates.ts`: Subscribe to `monitor:status-change` event, store latest timestamp per monitor for deduplication
- [ ] T023 [US1] Implement deduplication logic in web hook: Only process events where `event.timestamp > lastSeenTimestamp[monitorId]`
- [ ] T024 [US1] Update `apps/web/src/monitors/MonitorsPage.tsx` to use `useMonitorUpdates()` hook: Listen to status changes and update monitor row state in real-time
- [ ] T025 [US1] Update `apps/web/src/monitors/MonitorDetailPage.tsx` to listen to status updates for the viewed monitor and update detail page in real-time
- [ ] T026 [US1] Update "recent checks" list in monitor detail page to add new checks as they arrive via Socket.io without full page reload
- [ ] T027 [US1] Add logging to `SocketService` for status change events (debug via API logs)

**Checkpoint**: User Story 1 complete and testable independently. Status updates work in real-time without polling.

---

## Phase 4: User Story 2 - Connection Lifecycle (Priority: P2)

**Goal**: Socket.io connection establishes on monitors page load, disconnects on unmount or tab hide, preventing resource leaks

**Independent Test**: Can be tested by observing connection state (DevTools Network tab, console logs) as user navigates; verify 0 open connections after unmount

### E2E Tests for User Story 2

- [x] T028 [P] [US2] Write E2E test: Connection established only on `/monitors` page, not on other pages
- [x] T029 [P] [US2] Write E2E test: Connection closed after component unmount (DevTools should show closed socket)
- [x] T030 [P] [US2] Write E2E test: No socket connections leak after navigating away from monitors page

### Implementation for User Story 2

- [x] T031 [US2] Enhance `useSocket()` hook in `apps/web/src/hooks/useSocket.ts`: Add `useEffect` with cleanup to disconnect socket on unmount
- [x] T032 [US2] Implement tab visibility state management: Listen to `visibilitychange` event in `useSocket()` hook
- [x] T033 [US2] Implement pause/resume logic: When `document.hidden === true`, call `socket.disconnect()`; when `false`, call `socket.connect()`
- [x] T034 [US2] Update `useMonitorUpdates()` hook to handle reconnection: When socket reconnects, fetch full state via `GET /monitors` (existing API call) to sync after offline period
- [x] T035 [US2] Add `socket.on('reconnect', ...)` listener to `useMonitorUpdates()`: Trigger full state sync (call `fetchMonitors()`)
- [x] T036 [US2] Update `MonitorsPage.tsx` to display connection state indicator (optional UI: small icon showing "Live" or "Polling") for debugging
- [x] T037 [US2] Add debug logging: Socket connect/disconnect events logged to console (non-blocking)

**Checkpoint**: Connection lifecycle managed correctly. No socket leaks. Users see live indicator. Story 2 independently testable.

---

## Phase 5: User Story 3 - Stat Tile Updates (Priority: P2)

**Goal**: Monitor uptime % and latency tiles update in real-time as new checks are recorded

**Independent Test**: Can be tested by waiting for new checks, verifying stat tiles refresh without page reload

### E2E Tests for User Story 3

- [x] T038 [P] [US3] Write E2E test: Stat update event emitted after check is recorded
- [x] T039 [P] [US3] Write E2E test: Event includes all stat fields (uptime24h, latency24hAvg, latency24hMin, latency24hMax, timestamp)
- [x] T040 [P] [US3] Write E2E test: Only user's own monitor stats are sent to their room (multi-user isolation)

### Implementation for User Story 3

- [x] T041 [US3] Modify `apps/api/src/ping/ping.service.ts` in `recordResult()` method: After check is recorded and status updated, recompute stats for the monitor via `StatsService` (existing), then call `socketService.emitStatUpdate(userId, monitorId, uptime24h, latency24hAvg, latency24hMin, latency24hMax, Date.now())`
- [x] T042 [US3] Update `useMonitorUpdates()` hook to handle `monitor:stats-update` events: Listen to `socket.on('monitor:stats-update', ...)`
- [x] T043 [US3] Implement stat deduplication in hook: Only process events where `event.timestamp > lastSeenTimestamp[monitorId]` (same as status updates)
- [x] T044 [US3] Update `MonitorsPage.tsx` monitor row component: Listen to stat updates and re-render uptime % and latency tiles when events arrive
- [x] T045 [US3] Update `MonitorDetailPage.tsx`: Listen to stat updates for viewed monitor and update stat tiles in detail page in real-time
- [x] T046 [US3] Update latency chart on detail page (if exists): Add new latency data point without full-page reload (append to existing data)
- [x] T047 [US3] Add logging to `SocketService` for stat update events (debug via API logs)

**Checkpoint**: Stat tiles update in real-time. Users see uptime % and latency change instantly as checks complete. Story 3 independently testable.

---

## Phase 6: User Story 4 - Graceful Degradation (Priority: P3)

**Goal**: If Socket.io fails or is unavailable, app falls back to existing 15-second polling without errors

**Independent Test**: Can be tested by disabling Socket.io or simulating connection failure; verify polling resumes automatically and users see updates (delayed but functional)

### E2E Tests for User Story 4

- [x] T048 [P] [US4] Write E2E test: Connection failure triggers fallback to polling
- [x] T049 [P] [US4] Write E2E test: When polling resumes, status and stat updates still arrive (every 15 seconds)
- [x] T050 [P] [US4] Write E2E test: No errors in console when Socket.io unavailable; app continues to function

### Implementation for User Story 4

- [x] T051 [US4] Update `useMonitorUpdates()` hook to detect Socket.io disconnect: Add `socket.on('disconnect', ...)`
- [x] T052 [US4] Implement polling fallback: When `socket.on('disconnect')` fires, enable polling timer to call `fetchMonitors()` every 15 seconds
- [x] T053 [US4] Implement polling resume: When `socket.on('connect')` fires, disable polling timer and resume real-time listening
- [x] T054 [US4] Handle failed Socket.io connection attempt: If connection never establishes, fallback to polling automatically within 1 second
- [x] T055 [US4] Add visual indicator (optional): When polling is active (Socket.io down), show a small "Polling" badge instead of "Live" (helps users understand why updates are delayed)
- [x] T056 [US4] Ensure no duplicate polling + real-time events: When both are running temporarily, ensure updates are not doubled

**Checkpoint**: Graceful fallback fully implemented. If Socket.io fails, users see updates via polling (slower but reliable). Story 4 independently testable.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Validation, documentation, and quality improvements across all stories

- [x] T057 [P] Run manual validation against `quickstart.md` scenarios (all 8 scenarios, manual testing required)
- [x] T058 [P] Verify all E2E tests pass: `npm run test:e2e -w @saas-pulse/api` (Socket.io test suite)
- [x] T059 [P] Verify API linting and formatting: `npm run lint -w @saas-pulse/api` and `npm run format -w @saas-pulse/api`
- [x] T060 [P] Verify web linting: `npm run lint -w @saas-pulse/web`
- [x] T061 Add feature documentation to project README (Socket.io real-time feature description)
- [x] T062 Add Socket.io event type documentation in `packages/shared/src/socket-events.ts` (JSDoc comments for API clients)
- [x] T063 Create `.env.example` update if Socket.io requires new environment variables
- [x] T064 Add Socket.io connection debug output to web app console (during development)
- [x] T065 Code cleanup: Remove any placeholder comments, dead code, or debug logs
- [x] T066 Verify cross-browser WebSocket support (Chrome, Firefox, Safari) via manual testing
- [x] T067 Verify multi-user isolation via E2E tests (two authenticated users cannot see each other's updates)

---

## Dependencies & Execution Order

### Phase Dependencies

```
Setup (Phase 1)
    ↓
Foundational (Phase 2) ← BLOCKS all user stories
    ↓
┌───────────────────────────────┐
├─ User Story 1 (Phase 3) [P1]  ├─ Can run in parallel
├─ User Story 2 (Phase 4) [P2]  ├─ after Foundation
├─ User Story 3 (Phase 5) [P2]  ├─ complete
└─ User Story 4 (Phase 6) [P3]  ┘
    ↓
Polish (Phase 7)
```

### Within Each Phase

- **Setup**: All tasks sequential (build on each other)
- **Foundational**: Tasks marked [P] can run in parallel (different files); others sequential
- **User Stories**: Each story independent; stories can run in parallel by different developers
  - Within a story: Tests (if marked [P]) can run in parallel; implementation sequential (dependencies noted)

### User Story Dependencies

- **User Story 1 (P1)**: No dependencies on other stories; start after Foundational
- **User Story 2 (P2)**: No dependencies on US1; can start after Foundational (integrates with US1 if both done, but independently testable)
- **User Story 3 (P2)**: No dependencies on US1 or US2; can start after Foundational
- **User Story 4 (P3)**: No hard dependencies; enhances US1-3 but can be implemented independently

### Parallel Opportunities

**Setup Phase**:
- T001, T002, T003, T004: All independent (different files)

**Foundational Phase**:
- T005-T012: Sequential (each builds on Socket.io infrastructure)
- T013: Parallel with T005-T012 (E2E test file can be written concurrently)
- T014-T016: Parallel (T014, T015 for useSocket hook; T016 for useMonitorUpdates)

**User Stories** (after Foundational):
- All four stories can start in parallel:
  ```
  Developer A → User Story 1 (T020-T027)
  Developer B → User Story 2 (T031-T037)
  Developer C → User Story 3 (T041-T047)
  Developer D → User Story 4 (T051-T056)
  ```

**Within User Story 1**:
- T017-T019: All E2E tests can run in parallel (if executed)
- T020-T027: Sequential (each task depends on previous implementation)

**Polish Phase**:
- T057-T060: All [P] tasks can run in parallel (validation and linting)
- T061-T067: Sequential (documentation, cleanup, testing)

---

## Parallel Example: All Stories After Foundation

```bash
# Once Foundational (Phase 2) completes, launch these in parallel:

Task US1-T020: Modify MonitorsService to emit status changes
Task US1-T031: Enhance useSocket hook
Task US2-T041: Modify PingService to emit stat updates
Task US3-T051: Implement polling fallback

# Each story proceeds independently; merge to main as each story completes
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. ✅ Complete Phase 1: Setup (T001-T004)
2. ✅ Complete Phase 2: Foundational (T005-T016) ← CRITICAL
3. ✅ Complete Phase 3: User Story 1 (T017-T027)
4. **STOP and VALIDATE**: Run quickstart.md Scenario 1 (real-time status updates)
5. Test and merge to main
6. **FEATURE READY FOR DEPLOYMENT**: Real-time status updates work end-to-end

**Deployment Checkpoint**: At this point, feature can be released with P1 functionality. Users see monitor status changes in real-time.

### Incremental Delivery

- **Release 1 (MVP)**: Phase 1 + 2 + 3 → Real-time status updates (core feature)
- **Release 2**: Add Phase 4 → Connection lifecycle (resource management)
- **Release 3**: Add Phase 5 → Stat tile updates (complete real-time dashboard)
- **Release 4**: Add Phase 6 → Graceful degradation (reliability)

Each release is independently valuable and deployable.

### Parallel Team Strategy (4 Developers)

```
Day 1-2:
  Team: Complete Setup + Foundational together (all 4 work on T001-T016)
    Checkpoint: Foundation ready

Day 3-5:
  Developer A: User Story 1 (Status updates) T017-T027
  Developer B: User Story 2 (Connection) T031-T037
  Developer C: User Story 3 (Stats) T041-T047
  Developer D: User Story 4 (Fallback) T051-T056

Day 6:
  Team: Regroup for integration testing and validation
  Team: Run Phase 7 (Polish) T057-T067

Day 7:
  Team: Final validation against quickstart.md
  Team: Merge and deploy
```

---

## Task Completion Notes

### Format Verification

All tasks follow strict format:
- ✅ `- [ ]` checkbox
- ✅ Task ID (T001-T067)
- ✅ [P] for parallelizable tasks (different files, no dependencies)
- ✅ [USN] for user story tasks
- ✅ Clear description with file paths
- ✅ Dependencies noted where applicable

### Avoiding Common Pitfalls

- ❌ Never run US2-4 before US1 (stories are independent, not sequential)
- ❌ Never skip Foundational (Phase 2) - all stories depend on it
- ❌ Never run Socket.io tasks in parallel with overlapping files (e.g., T005 and T006 modify same gateway.ts)
- ❌ Never assume tests pass without running them (E2E tests must be executed)
- ❌ Never deploy without running quickstart.md validation (manual testing required)

### Definition of Done (Per Task)

- Code written and committed
- Tests pass (if test task)
- Linting passes (`npm run lint`)
- For stories: Independent test scenario passes from quickstart.md
- For foundational: No breaking changes to existing code

### Rollout Checklist (Before Merge to Main)

- [ ] Phase 1 (Setup) complete
- [ ] Phase 2 (Foundational) complete and tested
- [ ] At least User Story 1 complete
- [ ] E2E tests pass (T017-T019 for US1)
- [ ] Quickstart.md Scenario 1 validated manually
- [ ] No breaking changes to existing polling mechanism
- [ ] Code review complete
- [ ] CI/CD pipeline passes

---

## Notes for Implementation

- **Socket.io Polling Fallback**: Already built into Socket.io client library; no custom implementation needed beyond `useMonitorUpdates()` logic
- **Multi-User Isolation**: E2E tests in T013 are CRITICAL - ensure every user only receives their own monitor events
- **Timestamp Deduplication**: Implemented client-side in hooks; server can emit duplicates, client handles them
- **State Sync on Reconnection**: Full `GET /monitors` fetch on reconnect; no event queuing/replay system (YAGNI)
- **No Database Changes**: All events ephemeral; no schema migration needed
- **Ponytail Note**: Single-server Socket.io. If 1000+ concurrent users needed in future, add Redis adapter (`@socket.io/redis-adapter`)
