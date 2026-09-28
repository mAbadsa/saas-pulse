# Feature Specification: Ping Service

**Feature Branch**: `004-ping-service`

**Created**: 2026-09-27

**Status**: Draft

**Input**: User description: "Ping service: periodically check every active monitor's URL on its own interval, record each result (up/down, HTTP status code, latency, error) as check history, and update the monitor's current status. Must block requests to internal/private network addresses (SSRF), as deferred from 003-monitors-crud."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - My monitors get checked automatically (Priority: P1)

A user who has added a monitor expects SaaS Pulse to check the URL regularly, at the interval they chose, without doing anything else.

**Why this priority**: This is the core promise of the product. Without it, monitors are just a saved list of URLs.

**Independent Test**: Create a monitor pointing at a reachable URL, let one check cycle run, and confirm the monitor now shows a status other than "pending" and a last-checked time, and that one check record exists for it.

**Acceptance Scenarios**:

1. **Given** an active monitor that has never been checked, **When** the next check cycle runs, **Then** its URL is checked, a check record is stored, and the monitor's status and last-checked time are updated.
2. **Given** an active monitor with a 300-second interval that was checked 100 seconds ago, **When** a check cycle runs, **Then** it is **not** checked again yet.
3. **Given** the same monitor checked 300 or more seconds ago, **When** a check cycle runs, **Then** it is checked.
4. **Given** a paused monitor, **When** check cycles run, **Then** it is never checked, and its status and last-checked time stay unchanged.

---

### User Story 2 - I can tell whether a site is up or down, and why (Priority: P1)

For every check, the user can later see whether the site was reachable, what HTTP status it answered with, how long it took, and, when it failed, the reason.

**Why this priority**: The status is the product's main output. A "down" status with no reason gives the user nothing to act on.

**Independent Test**: Point monitors at a URL answering 200, one answering 500, one that never answers, and one that refuses connections. After a cycle, confirm up / down(500) / down(timeout) / down(connection refused) respectively, each with the matching details.

**Acceptance Scenarios**:

1. **Given** a URL answering with 200–399, **When** it is checked, **Then** the check is recorded as up, with the status code and the response time in milliseconds, and the monitor's status becomes "up".
2. **Given** a URL answering 400–599, **When** it is checked, **Then** the check is recorded as down with that status code and the response time, and the monitor's status becomes "down".
3. **Given** a URL that doesn't answer within the time limit (10 seconds by default), **When** it is checked, **Then** the check is recorded as down with no status code and an error saying it timed out, and the monitor's status becomes "down".
4. **Given** a URL whose host doesn't resolve or refuses the connection, **When** it is checked, **Then** the check is recorded as down with no status code and the network error message.
5. **Given** a URL that answers with a redirect (3xx), **When** it is checked, **Then** it counts as up with that 3xx code. The redirect is **not** followed.

---

### User Story 3 - SaaS Pulse can't be used to probe private networks (Priority: P1)

A malicious user must not be able to use monitors to reach addresses inside the hosting network (loopback, private ranges, cloud metadata services), even with DNS tricks.

**Why this priority**: This is a security requirement. Server-side request forgery against a monitoring service is a well-known attack, and this was explicitly deferred to this feature by 003-monitors-crud.

**Independent Test**: Create monitors for `http://127.0.0.1`, `http://169.254.169.254` and `http://[::1]`, and for a hostname that resolves to a private address. After a cycle, each is recorded as down with a "blocked address" error, and no connection was made.

**Acceptance Scenarios**:

1. **Given** a monitor whose URL host is a literal private, loopback, link-local or otherwise non-public address (IPv4 or IPv6, including IPv4-mapped IPv6), **When** it is checked, **Then** no connection is attempted and the check is recorded as down with an error naming the blocked address.
2. **Given** a monitor whose hostname resolves to any non-public address, **When** it is checked, **Then** the connection is refused **at the moment of connecting**, not in an earlier look-up that DNS could change afterwards, and the check is recorded as down with a blocked-address error.
3. **Given** an operator running locally who explicitly enables private targets in configuration, **When** a monitor points at `localhost`, **Then** it is checked normally. This setting is off by default.

---

### Edge Cases

- **Deleted during a check:** if a monitor is deleted while its check is running, the result is discarded silently and no error is logged.
- **URL changed during a check:** if the URL is edited while its check is running, the result for the old URL is discarded. The next cycle checks the new URL.
- **Paused during a check:** a check that is already running still records its result.
- **Many monitors due at once:** they are checked concurrently with a fixed limit on simultaneous requests, and the rest wait for later cycles, so the service can't flood the network or itself.
- **Slow cycles:** if one cycle is still running when the next is due, the next one is skipped rather than overlapping.
- **Huge or streaming responses:** only the status line and headers are needed. The body is discarded without being downloaded, and response time is measured up to the headers.
- **Long error messages** are truncated to 500 characters before being stored.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST periodically find every active monitor that is due: never checked, or last checked at least its interval ago. It MUST check each one, running a cycle at least every 10 seconds.
- **FR-002**: Paused monitors MUST NOT be checked.
- **FR-003**: A check MUST make a single GET request to the monitor's URL, MUST NOT follow redirects, and MUST NOT download the response body.
- **FR-004**: A check MUST be recorded as up for status 200–399 and down for status 400–599, for a timeout, or for any network failure.
- **FR-005**: Each check MUST store: up/down, the HTTP status code (when a response arrived), the response time in milliseconds (when a response arrived), the error message (on failure, at most 500 characters), and the time of the check.
- **FR-006**: After each check, the monitor's status MUST become "up" or "down" to match, and its last-checked time MUST be updated.
- **FR-007**: A check MUST give up after a configurable time limit, 10 seconds by default.
- **FR-008**: The system MUST refuse to connect to non-public addresses, and MUST enforce this on the address actually being connected to, including every address a hostname resolves to. Blocked ranges: unspecified, loopback, private (RFC 1918), carrier-grade NAT, link-local (including 169.254.169.254), benchmarking, multicast and reserved IPv4 ranges; and IPv6 unspecified, loopback, unique-local, link-local, multicast and IPv4-mapped forms of any blocked IPv4 address.
- **FR-009**: Checking private addresses MAY be enabled by explicit configuration for local development. It MUST be off by default.
- **FR-010**: The number of simultaneous checks MUST be capped (10 by default). Cycles MUST NOT overlap.
- **FR-011**: A result MUST be discarded if, when it is saved, the monitor no longer exists or its URL has changed since the check started.
- **FR-012**: The periodic checking MUST be possible to switch off by configuration (for tests and one-off tooling). It MUST stop cleanly when the application shuts down.

### Key Entities

- **Check** (existing): one result for a monitor. It holds up/down, status code, latency, error and checked-at time. It belongs to a Monitor and is deleted with it.
- **Monitor** (existing): this feature reads `url`, `intervalSeconds`, `isActive` and `lastCheckedAt`, and writes `status` and `lastCheckedAt`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An active monitor that has never been checked is checked within 15 seconds of being created, while the service is running.
- **SC-002**: An active monitor is never checked more often than its interval, and is checked no later than its interval plus 15 seconds.
- **SC-003**: In automated tests, 100% of the four outcome types (up, HTTP error, timeout, network failure) are recorded with the correct up/down value and details.
- **SC-004**: In automated tests, 0 connections are made to any blocked address, whether written as a literal or reached through DNS resolution.
- **SC-005**: One slow or unresponsive site never delays other monitors' checks by more than the time limit.

## Assumptions

- **Single running API instance:** cycle overlap is prevented in memory. Running several instances would need a shared lock or a job queue; that's future work.
- **Redis status cache is deferred.** The monitor row already holds the current status and last-checked time, and listing monitors is a single indexed query. A Redis cache will be added when a reader needs it, such as live dashboard updates.
- **No retention limit on check history yet.** At the minimum 30-second interval, one monitor produces about 2,900 checks a day. A pruning policy belongs with the dashboard or plans feature.
- **Alerts on status changes are out of scope** (roadmap phase 3), as are multi-region checks and endpoints for reading check history.
- **Ordinary GET only:** a check uses a fixed user agent string. Custom headers, methods, request bodies and response-content assertions are out of scope.
- **Builds on 003-monitors-crud,** which stores monitor configuration and deliberately deferred private-address blocking to this feature.
