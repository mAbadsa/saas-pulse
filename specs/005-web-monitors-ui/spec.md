# Feature Specification: Web App – Sign-in & Monitors

**Feature Branch**: `005-web-monitors-ui`

**Created**: 2026-09-27

**Status**: Draft

**Input**: User description: "Frontend for what the API already supports: register and sign-in pages, and a monitors page where a signed-in user sees their monitors with live status, and can add, edit, pause/resume and delete them. Charts, uptime %, and real-time push updates come later."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create an account and sign in (Priority: P1)

A visitor creates an account, or signs in to an existing one, from the web app and lands on their monitors page.

**Why this priority**: Every other screen needs a signed-in user.

**Independent Test**: Open the app signed out, get sent to sign-in, switch to "Create account", register, and land on an empty monitors page. Reload the page and stay signed in.

**Acceptance Scenarios**:

1. **Given** a signed-out visitor, **When** they open any app page, **Then** they are taken to the sign-in page.
2. **Given** the registration form, **When** they enter a valid email and a password of 8 or more characters and submit, **Then** they are signed in and taken to the monitors page.
3. **Given** the registration form, **When** the email is already registered, or a field is invalid, **Then** a clear error is shown next to the form, their input is kept, and they can correct it.
4. **Given** the sign-in form, **When** the credentials are wrong, **Then** "Invalid email or password" is shown and the password field is cleared.
5. **Given** a signed-in user, **When** they reload the page or come back later (before their session expires), **Then** they are still signed in.
6. **Given** a signed-in user, **When** they choose "Sign out", **Then** they are signed out and returned to the sign-in page.
7. **Given** a signed-in user whose session has expired, **When** the app next talks to the server, **Then** they are returned to sign-in with the message "Your session expired, please sign in again".

---

### User Story 2 - See my monitors and their current status (Priority: P1)

A signed-in user sees all their monitors with each one's name, URL, current status (up, down, pending or paused), when it was last checked, and how often it is checked. The page stays current without reloading.

**Why this priority**: This is the product's main screen and the first reason to open the app.

**Independent Test**: With three monitors (one up, one down, one never checked), open the page and see each one with the correct status label and last-checked time. Wait for the next background check and see a changed status appear without reloading.

**Acceptance Scenarios**:

1. **Given** a user with monitors, **When** they open the monitors page, **Then** each one shows its name, URL, a status label (Up / Down / Pending / Paused), a last-checked time in relative form (for example "2 minutes ago", or "Never"), and its interval.
2. **Given** a user with no monitors, **When** they open the page, **Then** they see an explanation and a prominent "Add monitor" action instead of an empty table.
3. **Given** the page is open, **When** a monitor's status changes on the server, **Then** the page shows the new status within 30 seconds, without a reload.
4. **Given** the server can't be reached, **When** the page loads or refreshes, **Then** an error message with a "Try again" action is shown. Data that was already shown stays visible.
5. **Status labels** don't rely on colour alone: each has a text label, and up/down also use distinct icons.

---

### User Story 3 - Add and edit monitors (Priority: P1)

A user adds a monitor by giving a name, a URL and optionally an interval, and can later change any of them.

**Why this priority**: Without adding monitors from the UI, the app can only display data created some other way.

**Independent Test**: Add a monitor through the form and see it at the top of the list as Pending. Edit its name and see the change in the list.

**Acceptance Scenarios**:

1. **Given** the monitors page, **When** the user opens "Add monitor", fills in name and URL, and submits, **Then** the form closes and the new monitor appears at the top of the list as Pending with a 60-second interval.
2. **Given** the add or edit form, **When** the server rejects the input (for example an ftp URL or an interval under 30), **Then** the server's message is shown in the form, the form stays open, and the input is kept.
3. **Given** an existing monitor, **When** the user edits its name, URL or interval and saves, **Then** the list reflects the change. If the URL changed, the monitor shows as Pending again.
4. **Forms:** every field has a visible label. The interval field explains its allowed range (30–86,400 seconds). The submit button shows progress and can't be pressed twice.

---

### User Story 4 - Pause, resume and delete (Priority: P2)

A user pauses a monitor during maintenance and resumes it later, or deletes a monitor they no longer need.

**Why this priority**: Important housekeeping, but secondary to seeing and adding monitors.

**Independent Test**: Pause a monitor and see it labelled Paused; resume it and see its status again. Delete a monitor after confirming, and see it disappear.

**Acceptance Scenarios**:

1. **Given** an active monitor, **When** the user chooses "Pause", **Then** it shows as Paused immediately, and "Resume" is offered instead.
2. **Given** a paused monitor, **When** the user chooses "Resume", **Then** it shows its last known status again.
3. **Given** a monitor, **When** the user chooses "Delete", **Then** they are asked to confirm, with a warning that its check history will also be deleted. Only after confirming does it disappear.
4. **Given** any of these actions fails on the server, **Then** an error is shown and the list reflects the server's actual state.

---

### Edge Cases

- **Long names and URLs** are truncated in the list with the full value still available (for example on hover), and never break the layout.
- **Narrow screens (phones):** the list stays usable, with no horizontal page scroll, and actions are still reachable.
- **Deleted elsewhere:** if a monitor was deleted in another tab or session and the user acts on it, the action reports "Monitor not found" and the list refreshes.
- **Double submission:** pressing submit twice creates only one monitor.
- **Keyboard only:** every action (open dialog, submit, cancel, confirm delete) works with the keyboard, focus moves into dialogs and back out when they close, and Escape closes them.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app MUST provide sign-in and registration pages. Every other page MUST require a signed-in user, and a signed-out visitor who opens one MUST be redirected to sign-in.
- **FR-002**: The app MUST keep the user signed in across page reloads until their session expires or they sign out.
- **FR-003**: When the server reports the session is no longer valid, the app MUST sign the user out and return them to sign-in with an explanatory message.
- **FR-004**: The monitors page MUST list the user's monitors with name, URL, status label, relative last-checked time and interval, newest first, with an empty state when there are none.
- **FR-005**: The monitors list MUST refresh itself at least every 30 seconds while the page is open and visible.
- **FR-006**: Users MUST be able to add a monitor (name, URL, optional interval) and edit an existing one through a form.
- **FR-007**: Users MUST be able to pause and resume a monitor with a single action.
- **FR-008**: Users MUST be able to delete a monitor after an explicit confirmation that warns its history will be deleted.
- **FR-009**: Server validation errors MUST be shown in the relevant form, without losing the user's input.
- **FR-010**: Status MUST be conveyed with text (and icons for up/down), never colour alone. Paused MUST be shown distinctly from the last known status.
- **FR-011**: All interactive elements MUST be keyboard-operable with visible focus, and every form field MUST have a visible label.
- **FR-012**: The app MUST use the request and response formats shared with the API, not its own copies.

### Key Entities

- **Session**: the signed-in user's identity and access credential, kept in the browser until sign-out or expiry.
- **Monitor** (from the API): name, URL, interval, active flag, status, last-checked time.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new visitor can go from opening the app to having their first monitor listed in under 1 minute.
- **SC-002**: A status change made by the background checker is visible on an open monitors page within 30 seconds, without a reload.
- **SC-003**: Every action in the user stories (register, sign in, add, edit, pause, resume, delete, sign out) can be completed using only the keyboard.
- **SC-004**: At a 375-pixel-wide viewport, all monitor information and actions are reachable without horizontal page scrolling.
- **SC-005**: Every server-side validation error covered in the acceptance scenarios is shown to the user in the form where it happened.

## Assumptions

- **Access credential stored in browser storage** so it survives reloads. This is the simplest option, but a script injected through a cross-site scripting bug could read it. Moving to an HTTP-only cookie session is a follow-up to finish before any public deployment, and it needs API changes (cookie issuing, CSRF protection).
- **Polling, not push:** the list refreshes about every 15 seconds while the tab is visible. Real-time push (WebSockets) is roadmap phase 2.
- **Out of scope:** charts, uptime %, average latency, check history, alerts, profile/account settings, password reset.
- **The old API health page** (which showed database and Redis status) is replaced by the app. Health stays available at `/health` for operators.
- **Automated UI tests are not added** in this feature; the web workspace has no test runner yet. Verification is lint, type-check, production build, and a manual quickstart walkthrough in a browser. Adding a UI test setup is its own follow-up.
