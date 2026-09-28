# Implementation Plan: Web App – Sign-in & Monitors

**Branch**: `005-web-monitors-ui` | **Date**: 2026-09-27 | **Spec**: [spec.md](./spec.md)

## Summary

Replace the single health page in `apps/web` with a small routed app:

- **Pages:** `/login`, `/register` and `/` (monitors), built with `react-router` 7.
- **Session:** an `AuthProvider` context holds the session, persisted in `localStorage`.
- **API client:** a thin `fetch` wrapper in `src/lib/api.ts` attaches the Bearer token, parses errors into `ApiError`, and signs the user out on 401.
- **Monitors page:** loads the list, polls every 15 s while the tab is visible, and offers add/edit (one dialog form), pause/resume (a `PATCH { isActive }`) and delete (an alert dialog to confirm).
- **UI:** shadcn components (input, label, dialog, alert-dialog) added through the CLI, following the `styling` skill. Types come from `@saas-pulse/shared`.

## Technical Context

- **Language/Version**: TypeScript ~6.0, React 19, Vite 8
- **Primary Dependencies**:
  - existing: shadcn/ui (Base UI), Tailwind v4, lucide-react
  - **new: `react-router` ^7** (the only new runtime dependency)
- **Storage**: `localStorage` key `saas-pulse.session` (the token and `UserProfile`)
- **Testing**: no UI test runner (spec Assumptions). Gates are `npm run lint -w @saas-pulse/web`, `npm run build` (`tsc -b` + vite) and the quickstart walkthrough.
- **Target Platform**: evergreen browsers, from 375 px width up
- **Project Type**: SPA (the web workspace of a monorepo)
- **Constraints**:
  - refresh every 15 s or less (spec says 30 s or less)
  - no colour-only status
  - keyboard-operable; Base UI dialogs trap and restore focus
- **Scale/Scope**: 3 routes and about 8 small components

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Workspace Boundaries | ✅ | Uses the shared `AuthResponse`, `UserProfile`, `MonitorResponse`, `Create/UpdateMonitorRequest` and `ApiErrorResponse` through the existing Vite alias. No copies. |
| II. NestJS Module Structure | n/a | Web only |
| III. Code Style | ✅ | The web ESLint config; must pass `npm run lint -w @saas-pulse/web`. |
| IV. Data Model Discipline | n/a | No schema change |
| V. Simplicity | ✅ | One new dependency (a router is needed for real URLs and back-button behaviour). No React Query, state library or form library: a hook with `useState` + `useEffect` polling is enough for one list. Native HTML validation plus the server's messages, instead of a validation library. |
| VI. Auth & Tenant Isolation | ✅ | Isolation is enforced by the API. The client only sends the token. A 401 from any call clears the session (FR-003). |

**Post-design re-check:** ✅

## Project Structure

```text
apps/web/src/
├── main.tsx                     # BrowserRouter + AuthProvider + routes
├── App.tsx                      # route table + RequireAuth wrapper (replaces the health page)
├── lib/
│   ├── api.ts                   # api<T>(path, { method, body }) + ApiError; token from the session store
│   ├── session.ts               # load/save/clear the session in localStorage; onUnauthorized hook
│   └── time.ts                  # relativeTime(iso | null) using Intl.RelativeTimeFormat
├── auth/
│   ├── AuthProvider.tsx         # context: user, signIn(res), signOut(reason?)
│   └── AuthPage.tsx             # shared sign-in / register form (mode prop)
├── monitors/
│   ├── MonitorsPage.tsx         # header, list, empty/error states, polling
│   ├── MonitorRow.tsx           # one monitor (responsive card row) + actions
│   ├── MonitorFormDialog.tsx    # add / edit
│   ├── DeleteMonitorDialog.tsx  # confirm delete
│   └── StatusBadge.tsx          # Up / Down / Pending / Paused with icon + text
└── components/ui/               # + input, label, dialog, alert-dialog (shadcn CLI)
```

**Structure Decision**: feature folders (`auth/`, `monitors/`) in `src/`; generated primitives stay in `components/ui/`.

## Complexity Tracking

No violations.
