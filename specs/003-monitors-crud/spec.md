# Feature Specification: Monitors Management

**Feature Branch**: `003-monitors-crud`

**Created**: 2026-09-27

**Status**: Draft

**Input**: User description: "Monitors CRUD for the SaaS Pulse API: a signed-in user can create a monitor (name, URL, check interval), list their monitors, view one, edit it (name, URL, interval), pause/resume monitoring, and delete it together with all its check history. Monitors are strictly per-user (tenant isolation). This feature only manages monitor configuration — actually pinging URLs (the cron ping service), status caching in Redis, and web dashboard pages are out of scope."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Add a monitor (Priority: P1)

A signed-in user registers a website or API endpoint they want watched by giving it a name, the URL to check, and how often to check it.

**Why this priority**: Nothing can be monitored until monitors exist. Every later feature (checks, dashboard, alerts) reads from them.

**Independent Test**: Sign in, create a monitor, and confirm the response shows the monitor with the given name, URL and interval, a "pending" status (never checked yet), and monitoring switched on.

**Acceptance Scenarios**:

1. **Given** a signed-in user, **When** they create a monitor with name "Marketing site", URL `https://example.com` and interval 60 seconds, **Then** the monitor is saved and returned with a unique id, status "pending", monitoring active, no last-checked time, and creation/update timestamps.
2. **Given** a signed-in user, **When** they create a monitor without an interval, **Then** it defaults to 60 seconds.
3. **Given** a signed-in user, **When** they submit a URL that is not http or https (for example `ftp://…`, `javascript:…`, or no scheme at all), **Then** the request is rejected with a validation error on the URL field.
4. **Given** a signed-in user, **When** they submit an interval below 30 seconds or above 86,400 seconds (1 day), or one that is not a whole number, **Then** the request is rejected with a validation error on the interval field.
5. **Given** a signed-in user, **When** they include an owner id, a status or an id in the request, **Then** the request is rejected. The owner is always the signed-in user and the status starts as "pending".

---

### User Story 2 - See my monitors (Priority: P1)

A signed-in user sees every monitor they own, and can open a single monitor to see its details.

**Why this priority**: Without seeing what exists, users can't manage monitors, and the future dashboard has nothing to show.

**Independent Test**: Create two monitors, list them and see both (newest first), then fetch one by id and get its full details.

**Acceptance Scenarios**:

1. **Given** a user with three monitors, **When** they list monitors, **Then** they receive exactly those three, newest first.
2. **Given** a user with no monitors, **When** they list monitors, **Then** they receive an empty list, not an error.
3. **Given** a user who owns monitor M, **When** they request M by id, **Then** they receive M's full details.
4. **Given** an id that doesn't match any monitor, or is not a valid id at all, **When** a user requests it, **Then** the response is "not found".

---

### User Story 3 - Change a monitor (Priority: P2)

A user corrects or tunes a monitor: renames it, points it at a new URL, or changes how often it's checked. Any subset of these fields can be changed in one request.

**Why this priority**: Important for day-to-day use, but deleting and recreating a monitor is a workable fallback, so it ranks below create and view.

**Independent Test**: Create a monitor, change only its name, and confirm the name changed while the URL and interval stayed the same.

**Acceptance Scenarios**:

1. **Given** a monitor, **When** the owner changes only its name, **Then** only the name (and the update time) changes.
2. **Given** a monitor with status "up" and a last-checked time, **When** the owner changes its URL, **Then** the status returns to "pending" and the last-checked time is cleared, because the old result described a different address. Existing check history is kept.
3. **Given** a monitor, **When** the owner changes only its name or interval, **Then** its status and last-checked time are unchanged.
4. **Given** an update with an invalid URL or interval, **When** it is submitted, **Then** it is rejected with the same validation rules as creation, and nothing is changed.
5. **Given** an update with no fields at all, **When** it is submitted, **Then** it is rejected with a validation error.

---

### User Story 4 - Pause and resume monitoring (Priority: P2)

A user temporarily stops a monitor from being checked, for example during planned maintenance, without losing its configuration or history, and later turns it back on.

**Why this priority**: This avoids false "down" results during planned work. It is a small addition on top of editing.

**Independent Test**: Pause a monitor and confirm it shows as inactive with its last status kept; resume it and confirm it shows as active again.

**Acceptance Scenarios**:

1. **Given** an active monitor with status "up", **When** the owner pauses it, **Then** it is marked inactive and its status stays "up" as the last known result.
2. **Given** a paused monitor, **When** the owner resumes it, **Then** it is marked active again.
3. **Given** a monitor that is already paused, **When** the owner pauses it again, **Then** the request succeeds and nothing changes. Resuming an active monitor behaves the same way.

---

### User Story 5 - Delete a monitor (Priority: P2)

A user removes a monitor they no longer need. Its entire check history is removed with it.

**Why this priority**: Needed to keep the list tidy and to stop checking addresses that no longer matter.

**Independent Test**: Create a monitor with some check history, delete it, and confirm both the monitor and its checks are gone and that fetching it returns "not found".

**Acceptance Scenarios**:

1. **Given** a monitor with check history, **When** the owner deletes it, **Then** the request succeeds with no content, and afterwards neither the monitor nor any of its checks exist.
2. **Given** a monitor that has already been deleted, **When** the owner deletes it again, **Then** the response is "not found".

---

### User Story 6 - Nobody else can see or touch my monitors (Priority: P1)

Each user's monitors are private. Another signed-in user can't see, change, pause or delete them, and can't even tell that they exist.

**Why this priority**: This is a multi-tenant product, and leaking or allowing edits to another customer's monitors would be a serious security failure. It is also the end-to-end proof of the isolation rule set up by the authentication feature.

**Independent Test**: User A creates a monitor. User B lists monitors and doesn't see it. Then user B tries to view, update, pause, resume and delete it by id, and every attempt returns "not found". A's monitor is left unchanged.

**Acceptance Scenarios**:

1. **Given** user A owns monitor M, **When** user B lists monitors, **Then** M is not included.
2. **Given** user A owns monitor M, **When** user B tries to view, update, pause, resume or delete M by id, **Then** every attempt returns "not found" (never "forbidden"), and M is unchanged.
3. **Given** no sign-in credential, **When** anyone calls any monitor operation, **Then** it is rejected as unauthorized.

---

### Edge Cases

- **Surrounding whitespace:** a name or URL with leading or trailing whitespace is trimmed before it is validated and stored. A name that is empty after trimming is rejected.
- **Credentials in the URL:** a URL like `https://user:pass@host` is rejected, so the monitor configuration never stores secrets.
- **Very long values:** a URL longer than 2,048 characters, or a name longer than 100 characters, is rejected.
- **Duplicates:** the same URL may be monitored more than once by the same user (for example at different intervals), and names don't have to be unique.
- **Deleting while a check is running:** deleting a monitor while a check for it is in progress is left to the ping service. From this feature's side, the delete removes everything that exists at that moment.
- **Owner deletes their account:** all their monitors and check history are removed as well.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A signed-in user MUST be able to create a monitor with a name (1–100 characters after trimming), a URL, and an optional check interval in whole seconds from 30 to 86,400, defaulting to 60.
- **FR-002**: The URL MUST be absolute, use http or https, contain no embedded credentials, and be at most 2,048 characters.
- **FR-003**: A new monitor MUST start with status "pending", monitoring active, no last-checked time, and the signed-in user as owner.
- **FR-004**: A user MUST be able to list all of their own monitors, newest first, and nothing else.
- **FR-005**: A user MUST be able to retrieve one of their own monitors by id. The response includes name, URL, interval, active flag, status, last-checked time and timestamps.
- **FR-006**: A user MUST be able to update any subset of name, URL and interval on their own monitor, using the same validation as creation. An empty update MUST be rejected.
- **FR-007**: Changing a monitor's URL MUST reset its status to "pending" and clear its last-checked time. Changing only the name or interval MUST leave them unchanged. Existing check history is never modified by an update.
- **FR-008**: A user MUST be able to pause and resume their own monitor. Pausing sets it inactive and keeps its last status. Both operations are idempotent.
- **FR-009**: A user MUST be able to delete their own monitor. Deletion MUST also permanently remove all of that monitor's check history.
- **FR-010**: Every monitor operation MUST be limited to monitors owned by the signed-in user. Any id that doesn't exist or belongs to another user, including malformed ids, MUST produce "not found".
- **FR-011**: The owner, id, status and last-checked time MUST NOT be settable through create or update requests. Requests containing them, or any other unknown field, MUST be rejected.
- **FR-012**: All monitor operations MUST require a signed-in user.
- **FR-013**: The request and response formats for monitors MUST be defined once and shared by the API and the web app.

### Key Entities

- **Monitor**: a URL a user wants watched, owned by exactly one User. It has:
  - name, URL and check interval (seconds)
  - active flag (paused or not)
  - status: pending, up or down; this feature only ever sets or resets "pending"
  - last-checked time
  - created and updated times
- **Check** (existing): one result of checking a monitor. It is not created or read by this feature, only deleted along with its monitor.
- **User** (existing): the owner. Identity comes from the signed-in session.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A signed-in user can add their first monitor with a single request and see it in their list immediately afterwards.
- **SC-002**: In automated tests with two users, 0 cross-user attempts (list, view, update, pause, resume, delete) succeed or reveal that the other user's monitor exists.
- **SC-003**: 100% of the invalid inputs listed in the acceptance scenarios and edge cases are rejected with a message naming the invalid field, and none of them changes any stored data.
- **SC-004**: After a monitor is deleted, 0 of its check records remain.
- **SC-005**: Each monitor operation completes in under 1 second for a user with up to 100 monitors under normal local conditions.

## Assumptions

- **Out of scope:** checking URLs (the ping service), caching status in Redis, and web dashboard pages. This feature only manages configuration. It never sets status to "up" or "down"; it only sets or resets "pending".
- **Protection against internal addresses (SSRF) is deferred.** A URL could point at `localhost` or a private network address. Blocking that reliably requires checking at request time, because a DNS name can change what it points to after it was saved. So the ping service will check the resolved address before every request. This feature only enforces the http/https scheme and the no-credentials rule. The ping service spec must include the address check.
- **No per-user limit on the number of monitors.** Quotas belong with future pricing plans. SC-005 assumes up to 100 monitors per user.
- **No pagination:** listing returns all of a user's monitors. Pagination can be added if users get large lists.
- **Check history is not exposed** by this feature. The dashboard feature will read it.
- **Data model:** `Monitor` already exists in the schema with every field this feature needs (`name`, `url`, `intervalSeconds`, `isActive`, `status`, `lastCheckedAt`, `userId`, timestamps), so no schema migration should be needed.
- **Built on the authentication feature (002-jwt-auth):** signed-in identity and "protected by default" come from there. Constitution Principle VI governs isolation.
