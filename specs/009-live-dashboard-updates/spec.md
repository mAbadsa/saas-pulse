# Feature Specification: Live Dashboard Updates

**Feature Branch**: `009-live-dashboard-updates`

**Created**: 2026-09-30

**Status**: Draft

**Input**: User description: "Socket.io live updates on Dashboard - Add real-time dashboard updates so team members see monitor status changes instantly without manual refreshes"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Real-time Status Updates (Priority: P1)

User is viewing the monitors dashboard. When a monitored service changes status (UP → DOWN or DOWN → UP), the user sees that change reflected immediately without manual refresh.

**Why this priority**: This is the core value proposition. Users currently wait up to 15 seconds (or must manually refresh) to see status changes. Instant visibility reduces response time to incidents.

**Independent Test**: Can be fully tested by starting a monitor, triggering a status change (manually or via test), and verifying the UI updates instantly without page reload.

**Acceptance Scenarios**:

1. **Given** user is viewing monitors page, **When** a monitored service goes DOWN, **Then** that monitor's status badge updates to "DOWN" within 500ms
2. **Given** user is viewing monitors page, **When** a monitored service comes back UP, **Then** that monitor's status badge updates to "UP" within 500ms
3. **Given** user is viewing a monitor detail page, **When** a new check arrives, **Then** the recent checks list updates without full-page reload

---

### User Story 2 - Connection Lifecycle (Priority: P2)

User opens/closes browser tabs and navigate between dashboard pages. The Socket.io connection establishes when needed and disconnects cleanly to avoid wasting resources.

**Why this priority**: Prevents resource leaks (open sockets), ensures app doesn't consume bandwidth when user isn't looking at it.

**Independent Test**: Can be tested by observing connection state (console/DevTools) as user navigates tabs and pages; verifies connect on monitors page load and disconnect on unmount/tab hide.

**Acceptance Scenarios**:

1. **Given** user opens monitors page, **When** page loads, **Then** Socket.io connection is established
2. **Given** user is on monitors page with active connection, **When** user switches to another tab, **Then** connection is closed or put to sleep
3. **Given** user switches back to tab with monitors page, **When** tab becomes visible again, **Then** connection is re-established if closed

---

### User Story 3 - Stat Tile Updates (Priority: P2)

User is viewing the monitors dashboard. When monitor stats (24h uptime %, latency) are updated on the server, the stat tiles reflect the new values in real-time.

**Why this priority**: Completes the real-time experience; users see not just status but also uptime trends update live.

**Independent Test**: Can be tested by waiting for stats to be computed (happens on each check), then verifying stat tile values update live without refresh.

**Acceptance Scenarios**:

1. **Given** user is viewing monitors page, **When** a new check result is recorded, **Then** the 24h uptime % updates to reflect the new data
2. **Given** user is viewing monitors page, **When** a new latency check is recorded, **Then** the 24h average latency updates

---

### User Story 4 - Graceful Degradation (Priority: P3)

Socket.io connection fails or is unavailable. The app falls back to the existing polling mechanism so the user still sees updates, even if not real-time.

**Why this priority**: Reliability. If Socket.io fails, the app doesn't break; it gracefully degrades to the current 15s polling behavior.

**Independent Test**: Can be tested by disabling Socket.io on server or network, then verifying polling resumes and user sees updates (albeit delayed).

**Acceptance Scenarios**:

1. **Given** Socket.io connection fails, **When** user is on monitors page, **Then** polling resumes automatically
2. **Given** Socket.io is not available on server, **When** user loads monitors page, **Then** app falls back to polling without errors

---

### Edge Cases

- What happens when connection is closed/dropped mid-message? (Should reconnect transparently)
- How does system handle rapid status changes (e.g., flapping UP/DOWN)? (Should show latest state, not process every intermediate state)
- What if user closes the monitors page but Socket.io continues broadcasting? (Connection should close on unmount)
- How does system behave when multiple status updates arrive out-of-order? (Should use server timestamp to ensure latest state wins)
- What happens on network reconnect after offline period? (Should sync full state, not assume what changed)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST establish a Socket.io connection when monitors page loads and close it on unmount
- **FR-002**: System MUST emit real-time status change events (UP/DOWN) to connected clients via Socket.io
- **FR-003**: System MUST emit real-time stat update events (uptime %, latency) to connected clients when checks are recorded
- **FR-004**: Each Socket.io event MUST include a server timestamp to ensure clients can handle out-of-order delivery
- **FR-005**: System MUST fall back to 15-second polling if Socket.io connection fails or is unavailable
- **FR-006**: Clients MUST disconnect Socket.io when monitors page is unmounted or browser tab becomes inactive
- **FR-007**: System MUST scope all Socket.io events to the authenticated user (only receive updates for own monitors)
- **FR-008**: Clients MUST update UI state when status or stat updates are received without full-page reload
- **FR-009**: System MUST handle reconnection logic transparently (auto-reconnect on network loss)
- **FR-010**: Clients MUST NOT display stale state if they go offline and come back online (must re-sync with server)

### Key Entities

- **SocketEvent (Status Change)**: Event emitted when monitor status changes. Includes monitor ID, new status, timestamp.
- **SocketEvent (Stat Update)**: Event emitted when monitor stats are updated. Includes monitor ID, uptime %, latency, timestamp.
- **Socket.io Connection**: Authenticated, user-scoped connection. One per user session; closes on logout or page unmount.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Real-time updates reach the client within 500ms of the server state change (excluding network latency)
- **SC-002**: No duplicate status badges or stat updates displayed (idempotent updates)
- **SC-003**: Socket.io connection automatically reconnects within 5 seconds after network loss
- **SC-004**: Fallback polling resumes within 1 second if Socket.io fails
- **SC-005**: No open connections left on monitors page unmount (verified by DevTools)
- **SC-006**: Users see stat tiles update live; 95% of users surveyed report "much faster" or "instantly" for status visibility (vs. current 15s polling)

## Assumptions

- Socket.io server-side implementation is added to the NestJS API (Gateway + connected client tracking)
- Socket.io client library (`socket.io-client`) is already or will be installed in the React app
- Current polling mechanism (15s interval) remains as a fallback and is not removed
- User-scoped namespaces or rooms are implemented to prevent cross-user data leaks
- Connection lifecycle is managed by React (cleanup in useEffect, etc.)
- Server emits updates based on existing `PingService.recordResult()` and stats computation flow (no new data sources)
- Browsers support WebSocket (standard for modern browsers); degradation to polling is fallback only
- "Graceful degradation" means automatic fallback to polling; no UI message needed unless user opens DevTools
