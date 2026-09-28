# Research: Web App – Sign-in & Monitors

## 1. Routing

- **Decision:** `react-router` 7 in declarative mode (`BrowserRouter`, `Routes`, `Navigate`).
- **Rationale:** real URLs, a working back button and deep links to `/login` (a `ui-ux-pro-max` navigation rule). Declarative mode needs no data-router or loader setup.
- **Alternatives considered:** switching views with `useState` alone (no URLs or back button), and TanStack Router (heavier).

## 2. Data fetching and refresh

- **Decision:** a `useMonitors()` hook inside `MonitorsPage`, with `load()` via `api`. A `setInterval(load, 15_000)` runs while `document.visibilityState === 'visible'`, and the list also refreshes after each mutation.
- **Rationale:** one list, one refresh rule. React Query would add a dependency and patterns that a single page doesn't need (Principle V). Mutations are followed by a reload rather than optimistic updates, so the list always shows the server's real state (spec US4-4).
- **Lint note:** the `react-hooks/set-state-in-effect` rule (see the `styling` skill). Setting state inside async callbacks is fine; synchronous `setState` in the effect body is not.

## 3. Session and 401 handling

- **Decision:**
  - `session.ts` stores `{ accessToken, user }` in `localStorage`.
  - `api.ts` reads the token, and on a 401 **from any request other than `/auth/login` or `/auth/register`** calls a registered `onUnauthorized` callback. `AuthProvider` registers that callback to clear the session and navigate to `/login` with `state.reason = 'expired'`.
- **Rationale:** one central place handles expiry (FR-003). The login and register endpoints are excluded because their 401 means wrong credentials, not an expired session.
- **Trade-off:** storing the token in `localStorage` is readable by injected scripts. It's recorded in the spec, and the follow-up is httpOnly cookies.

## 4. Forms and errors

- **Decision:**
  - Native attributes (`required`, `type="email"`, `minLength={8}`, `type="url"`, `min={30}`, `max={86400}`) give instant client-side checks through the browser.
  - The server's messages (`ApiErrorResponse.message`, a string or string[]) are shown in a `role="alert"` box at the top of the form, which is focused after a failed submit.
  - Input stays controlled so nothing is lost.
- **Rationale:** follows `ui-ux-pro-max`'s "Focusable Error Summary" guidance using only platform features. The server stays the single source of truth for rules like the 72-byte password and `disallow_auth`.

## 5. Status presentation

| State | Shown when | Badge |
|-------|-----------|-------|
| Paused | `!isActive` (takes precedence) | `variant="outline"`, muted, `PauseCircle` icon, "Paused" |
| Up | `status === 'UP'` | outline + green text/border (the `styling` skill pattern), `CheckCircle2` icon, "Up" |
| Down | `status === 'DOWN'` | `variant="destructive"`, `XCircle` icon, "Down" |
| Pending | `status === 'PENDING'` | `variant="secondary"`, `Clock` icon, "Pending" |

A paused monitor's last known status is still shown as small text after "Paused" ("last: Up").

## 6. Responsive list

- **Decision:** a list of rows. On small screens each row stacks (name and URL, then the status and meta line, then the actions). From `sm:` up it becomes a single flex row. There's no `<table>`.
- **Rationale:** `ui-ux-pro-max`'s "Table Handling" guidance recommends a card layout on mobile. A single layout that adapts avoids keeping two versions of the markup.

## 7. Adding shadcn components

- **Decision:** `npx shadcn@latest add input label dialog alert-dialog` in `apps/web`, then check for the stray `apps/web/@/` folder the `styling` skill warns about.
