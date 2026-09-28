# Feature Specification: Dashboard Stats

**Feature Branch**: `007-dashboard-stats`

**Created**: 2026-09-28

**Status**: Draft

**Input**: User description: "Dashboard stats (roadmap phase 2): uptime % and average latency per monitor over 24 hours and 7 days, a monitor detail page with a latency chart and recent check results, and a retention policy so check history doesn't grow forever."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See how reliable each monitor has been (Priority: P1)

On the monitors list, a user sees at a glance each monitor's uptime percentage and average response time over the last 24 hours, next to its current status.

**Why this priority**: The current status only says "right now". Uptime and response time show whether a site is reliable, which is the main question a monitoring product answers.

**Independent Test**: With a monitor that has 3 up checks and 1 down check in the last 24 hours, with response times of 100, 200 and 300 ms, the list shows "75% uptime" and "200 ms avg".

**Acceptance Scenarios**:

1. **Given** a monitor with checks in the last 24 hours, **When** the user views the list, **Then** they see its uptime percentage (to one decimal place, e.g. "99.8%") and its average response time in milliseconds for that period.
2. **Given** a monitor with no checks in the last 24 hours (new, or paused all day), **When** the user views the list, **Then** it shows "No data yet" instead of a misleading 0% or 100%.
3. **Given** the list refreshes automatically, **When** new checks arrive, **Then** the figures update too, with no reload.

---

### User Story 2 - Dig into one monitor's history (Priority: P1)

A user opens a single monitor and sees its response time over time as a chart, its uptime and average response time for the chosen period, and its most recent individual check results, including the error message when a check failed.

**Why this priority**: When a site is down or slow, the user needs to know since when, how often, and why. The list alone can't show that.

**Independent Test**: Open a monitor with a day of history. See a response-time chart covering the last 24 hours, the period's uptime and average, and the last 20 checks with their status code or error. Switch to 7 days and see the chart and figures change.

**Acceptance Scenarios**:

1. **Given** a monitor, **When** the user opens its detail page, **Then** they see its name, URL, current status, and the selected period's uptime %, average response time and number of checks.
2. **Given** the detail page, **When** it shows the chart, **Then** it plots average response time per time slot (hourly for 24 hours, every 6 hours for 7 days). Slots with no response are shown as gaps, not as zero.
3. **Given** the detail page, **When** the user switches between "24 hours" and "7 days", **Then** the chart and figures update for that period, and the choice is kept in the page address so it survives a reload and can be shared.
4. **Given** the detail page, **When** the user looks at recent checks, **Then** they see the 20 most recent, newest first, each with time, up/down, status code, response time, and the error message for failures.
5. **Given** a monitor ID that doesn't exist or belongs to another user, **When** someone opens its detail page, **Then** they see "Monitor not found" with a link back to the list.
6. **The chart is accessible:** the key figures are also given as text, the chart has an accessible description, and hovering or focusing a point shows its exact time and value.

---

### User Story 3 - Check history doesn't grow forever (Priority: P2)

Old check results are removed automatically after a retention period, so the database stays a manageable size without anyone having to clean it up.

**Why this priority**: A single monitor at the minimum interval produces about 2,900 checks a day. Without cleanup, storage grows without limit and stats queries slow down.

**Independent Test**: With checks aged 31 days and 29 days, run the cleanup. The 31-day-old checks are gone and the 29-day-old checks remain.

**Acceptance Scenarios**:

1. **Given** checks older than the retention period (30 days by default), **When** cleanup runs, **Then** they are permanently deleted.
2. **Given** checks newer than the retention period, **When** cleanup runs, **Then** they are untouched.
3. **Given** the service is running, **Then** cleanup runs automatically at least once an hour, without affecting monitoring.

---

### Edge Cases

- **Paused periods** aren't counted as downtime: a paused monitor produces no checks, and uptime is computed only over checks that happened.
- **Response time for failed checks:** checks that got no response (timeout, network error, blocked) have no response time and are excluded from the average. 4xx/5xx responses do have a response time and are included.
- **A monitor with fewer than 24 hours of history** shows stats for the history that exists.
- **7-day stats need 7 days of history.** The retention period can't be set below 7 days.
- **Monitors deleted mid-request** simply stop appearing. Stats for a deleted monitor are "not found".

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: For each of the user's monitors, the system MUST provide uptime % (up checks ÷ all checks × 100) and average response time (mean over checks that got a response) for the last 24 hours, or "no data" when there were no checks.
- **FR-002**: For a single monitor and a chosen period (24 hours or 7 days), the system MUST provide: uptime %, average response time, number of checks, and a time series of average response time and uptime % per slot (1-hour slots for 24 hours, 6-hour slots for 7 days), including empty slots.
- **FR-003**: For a single monitor, the system MUST provide its 20 most recent checks, newest first, with time, up/down, status code, response time and error.
- **FR-004**: All stats MUST be limited to the signed-in user's own monitors. Anything else is "not found".
- **FR-005**: The monitors list MUST show each monitor's 24-hour uptime % and average response time, or "No data yet", and refresh them along with the list.
- **FR-006**: A monitor detail page MUST show the current status, the period stats, a response-time chart with gaps for empty slots, and the recent checks. The chosen period MUST be reflected in the page address.
- **FR-007**: The system MUST automatically delete checks older than a configurable retention period (default 30 days, minimum 7), at least hourly.
- **FR-008**: Figures MUST be readable without the chart: stats appear as text, and the chart has an accessible label.
- **FR-009**: The request and response formats for stats MUST be shared by the API and the web app.

### Key Entities

- **Monitor stats summary**: per monitor over 24 hours: uptime %, average response time, check count.
- **Monitor stats detail**: per monitor and period: the summary figures, plus a time series of slots (start time, average response time or none, uptime % or none, check count), plus the recent checks.
- **Check** (existing): the source data. It is deleted after the retention period.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can tell a monitor's 24-hour reliability from the list without opening anything.
- **SC-002**: Uptime and average figures match a hand calculation over the same checks exactly, to one decimal place for uptime and to the nearest millisecond for latency, in automated tests.
- **SC-003**: The detail page for a monitor with 7 days of history at a 30-second interval (about 20,000 checks) loads its stats in under 1 second locally.
- **SC-004**: After cleanup, 0 checks older than the retention period remain, and 0 newer checks are lost, in automated tests.
- **SC-005**: Every stat shown in the chart is also available as text (verified manually).

## Assumptions

- **No stored rollups:** stats are computed on request from the check history. That's enough at this scale thanks to the existing `(monitorId, checkedAt)` index. Precomputed rollups can come later if needed.
- **Periods are fixed** at 24 hours and 7 days. Custom date ranges, and uptime over 30 or 90 days, are out of scope, and retention bounds them anyway.
- **Polling, not push:** the list keeps its 15-second polling, and the detail page polls at the same rate. Socket.io push is still a later roadmap item.
- **The chart library is Recharts**, as named in the roadmap and the project's planned stack.
- **Alerts on status changes** are out of scope (roadmap phase 3).
