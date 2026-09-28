---

description: "Task list for 005-web-monitors-ui"
---

# Tasks: Web App – Sign-in & Monitors

**Input**: `/specs/005-web-monitors-ui/`. All paths are relative to `apps/web/`.

**Tests**: none automated (spec Assumptions). The gates are lint, build and the quickstart.

**Stories**:
- US1 Auth
- US2 List & status
- US3 Add/Edit
- US4 Pause/Resume/Delete

---

## Phase 1: Setup

- [X] T001 `npm install -w @saas-pulse/web react-router@^7`
- [X] T002 In `apps/web`: `npx shadcn@latest add input label dialog alert-dialog`. Then check for a stray `apps/web/@/` folder, and if it exists move its files into `src/…` and delete it (see the `styling` skill).

## Phase 2: Foundational

- [X] T003 [P] `src/lib/session.ts`:
  - `type Session = AuthResponse`
  - `loadSession()` (parses safely; returns null on bad JSON), `saveSession(s)`, `clearSession()`
  - `KEY = 'saas-pulse.session'`
- [X] T004 [P] `src/lib/api.ts`:
  - `API_URL` from `import.meta.env.VITE_API_URL ?? 'http://localhost:3000'`
  - `class ApiError extends Error { status; messages: string[] }`
  - `setUnauthorizedHandler(fn)`
  - `api<T>(path, { method?, body? })`:
    - add the JSON header and the Bearer token when there's a session
    - a 204 returns `undefined`
    - on a non-OK response, parse `ApiErrorResponse` (its `message` can be a string or an array) into `messages`
    - on a 401 where the path doesn't start with `/auth/`, call the handler
    - throw `ApiError`
  - a network failure throws `ApiError(0, ['Cannot reach the server'])`
- [X] T005 [P] `src/lib/time.ts`: `relativeTime(iso: string | null): string` gives "Never" for null, or `Intl.RelativeTimeFormat` output ("just now" under 10 s, then seconds, minutes, hours or days)
- [X] T006 `src/auth/AuthProvider.tsx`:
  - context `{ user: UserProfile | null, signIn(res: AuthResponse), signOut(reason?: 'expired') }`
  - the initial state comes from `loadSession()`
  - registers `setUnauthorizedHandler(() => signOut('expired'))`
  - `signOut` clears the session and `navigate('/login', { state: { reason } })`
  - export `useAuth()`
- [X] T007 `src/main.tsx` + `src/App.tsx`:
  - `BrowserRouter` › `AuthProvider` › `Routes` using the table in contracts/ui-routes.md
  - `RequireAuth` redirects to `/login` when there's no user
  - `PublicOnly` redirects to `/` when there's a user
  - remove the health page code from `App.tsx`

## Phase 3: US1 – Sign in / register (P1) 🎯

- [X] T008 [US1] `src/auth/AuthPage.tsx` with `mode: 'login' | 'register'`:
  - a centered `Card` with the "SaaS Pulse" title
  - labelled `Input`s:
    - email (`type=email required autoComplete=email`)
    - password (`required`, `minLength=8` for register, and `autoComplete` set to `current-password` or `new-password`)
    - optional name (register only)
  - the submit `Button` is disabled while submitting and says "Signing in…" / "Creating account…"
  - an error box: `role="alert" tabIndex={-1}`, focused after a failed submit, listing `ApiError.messages`
  - on a login 401, clear the password
  - the "session expired" notice comes from `location.state`
  - a link to the other mode
  - on success: `signIn(res)` → `navigate('/')`

## Phase 4: US2 – List & status (P1)

- [X] T009 [P] [US2] `src/monitors/StatusBadge.tsx`, following research §5 (icon + text; Paused wins and shows "last: X")
- [X] T010 [US2] `src/monitors/MonitorRow.tsx`:
  - a responsive row (research §6): name (`truncate` with `title`), URL (`truncate` with `title`, muted), StatusBadge, "Checked {relativeTime}", "Every {interval}s"
  - an actions slot for the buttons: Pause/Resume, Edit, Delete (icon buttons with `aria-label` and a visible text label from `sm:` up)
- [X] T011 [US2] `src/monitors/MonitorsPage.tsx`:
  - a header with the app name, the user's email and a "Sign out" button
  - "Add monitor" button
  - list states: loading (skeleton text), error (`role="alert"` with "Try again"; keep the previous data), empty state (explanation + "Add monitor"), list
  - `load()` via `api<MonitorResponse[]>('/monitors')`; polling every 15 s while `document.visibilityState === 'visible'`, cleaned up on unmount; don't call `setState` synchronously in the effect body

## Phase 5: US3 – Add / edit (P1)

- [X] T012 [US3] `src/monitors/MonitorFormDialog.tsx`:
  - a `Dialog` in add mode or edit mode (`monitor?: MonitorResponse`)
  - fields:
    - Name (`required maxLength=100`)
    - URL (`type=url required`, placeholder `https://example.com`)
    - Interval in seconds (`type=number min=30 max=86400 step=1`, default 60, with helper text "30–86,400 seconds")
  - submitting: create → `POST`; edit → `PATCH` with only the changed fields
  - on success: close and call `onSaved()` (the parent reloads)
  - on failure: an error `role="alert"` box inside the dialog; the dialog stays open and input is kept
  - submit disabled while pending
- [X] T013 [US3] Wire "Add monitor" (header and empty state) and each row's "Edit" to the dialog in `MonitorsPage.tsx`

## Phase 6: US4 – Pause / resume / delete (P2)

- [X] T014 [US4] Pause/Resume in `MonitorsPage.tsx`:
  - `PATCH { isActive: !m.isActive }` → reload
  - disable that row's buttons while the request runs
  - on error, show a page-level alert and reload
- [X] T015 [US4] `src/monitors/DeleteMonitorDialog.tsx`:
  - an `AlertDialog` with "Delete {name}?" and "This also deletes its entire check history. This can't be undone."
  - the confirm button is destructive, and the dialog closes after success
  - on success: `DELETE` → reload; on error (including 404 "Monitor not found"): show it, close, reload

## Phase 7: Polish

- [X] T016 [P] `README.md`: add the web app features to the status line. `CLAUDE.md`: add the `apps/web` structure (routes, `lib/api.ts`, `AuthProvider`, `monitors/`) and the note about the session in localStorage.
- [X] T017 Run `npm run lint -w @saas-pulse/web` and `npm run build`, and fix any failures
- [ ] T018 Walk through the quickstart against the running API and web app, including the 375 px width and keyboard-only steps

## Dependencies

T001–T002 → T003–T005 (in parallel) → T006 → T007 → US1 → US2 → US3 → US4 → Polish.

## Implementation Notes

- **The shadcn CLI quirk happened** (files written to `apps/web/@/…`). The four new components were moved to `src/components/ui/`. The generated `button.tsx` was byte-identical to the existing one, so it was discarded.
- **Two lint and type fixes:**
  - `load()` uses a `.then()` chain so `react-hooks/set-state-in-effect` doesn't flag it.
  - `ApiError` declares its fields explicitly, because `erasableSyntaxOnly` forbids constructor parameter properties.
- **Bug found in the browser walkthrough, then fixed:**
  - `/login` and `/register` rendered the same `AuthPage` instance, so the error and the typed email carried over when switching between them. Each route now has its own `key`.
  - Also set `<title>SaaS Pulse</title>` in place of the Vite template's "web".
- **Browser-verified so far:**
  - redirect to `/login` when signed out
  - wrong credentials show an alert that gets focus, the email is kept and the password is cleared
  - accessible names on the fields
- **T018 (the rest of the quickstart) was handed to the user.** The walkthrough stopped because the shared Chrome profile was signed in to the user's real account; add/edit/pause/delete, live refresh, the 375 px layout and keyboard-only use aren't browser-verified by the implementer.
