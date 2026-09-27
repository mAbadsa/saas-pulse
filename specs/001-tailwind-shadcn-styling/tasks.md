---
description: "Task list for Tailwind + shadcn/ui Styling System"
---

# Tasks: Tailwind + shadcn/ui Styling System

**Input**: Design documents from `/specs/001-tailwind-shadcn-styling/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: Not requested in the spec — this is a presentation-only change
verified manually via quickstart.md; no test tasks are included.

## Phase 1: Setup

- [X] T001 Add `tailwindcss` and `@tailwindcss/vite` as dependencies in `apps/web/package.json`
- [X] T002 Add the `@tailwindcss/vite` plugin to `apps/web/vite.config.ts` (alongside the existing `react()` plugin), and add a `@/*` alias to `resolve.alias` pointing at `apps/web/src`
- [X] T003 Add the matching `@/*` path mapping to `compilerOptions.paths` in `apps/web/tsconfig.app.json`
- [X] T004 Replace the contents of `apps/web/src/index.css` with `@import "tailwindcss";` (remove the prior hand-written base rules it contained)

**Checkpoint**: `npm run dev:web` starts with Tailwind utilities available (e.g. a `className="text-red-500"` smoke-test renders red), no build errors.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: shadcn/ui must be initialized and the primitives this feature needs must exist before `App.tsx` can be restyled.

**⚠️ CRITICAL**: Both user stories below depend on this phase.

- [X] T005 Run `npx shadcn@latest init` from `apps/web` (creates `apps/web/components.json` and `apps/web/src/lib/utils.ts`)
- [X] T006 [P] Run `npx shadcn@latest add card` from `apps/web` (creates `apps/web/src/components/ui/card.tsx`)
- [X] T007 [P] Run `npx shadcn@latest add badge` from `apps/web` (creates `apps/web/src/components/ui/badge.tsx`)
- [X] T008 [P] Run `npx shadcn@latest add button` from `apps/web` (creates `apps/web/src/components/ui/button.tsx`)

**Checkpoint**: `apps/web/src/components/ui/{card,badge,button}.tsx` exist and import cleanly (e.g. a throwaway `<Button>Test</Button>` in `App.tsx` renders styled).

---

## Phase 3: User Story 1 - Readable system status at a glance (Priority: P1) 🎯 MVP

**Goal**: Replace the raw-JSON health dump in `apps/web/src/App.tsx` with a
`Card` showing overall status and a `Badge` per dependency (database, redis),
each visually distinct by state (healthy / degraded / unreachable), plus a
manual re-check `Button`.

**Independent Test**: Load the app with `npm run db:up` running — see spec.md
Acceptance Scenarios 1–3 (healthy state, degraded state via `npm run
db:down`, manual re-check without full reload) and quickstart.md.

### Implementation for User Story 1

- [X] T009 [US1] In `apps/web/src/App.tsx`, extract the existing `fetch('/health')` logic (currently in the mount-only `useEffect`) into a named function so it can be called both on mount and from a re-check button, per research.md's decision to keep it in `App.tsx` (no hook extraction)
- [X] T010 [US1] Add an `isChecking: boolean` component-state flag (data-model.md) that is `true` only while a re-check fetch is in flight; existing `health`/`error` state must remain rendered underneath while `isChecking` is true (spec Edge Cases)
- [X] T011 [US1] Replace the `<pre>{JSON.stringify(health, ...)}</pre>` block in `apps/web/src/App.tsx` with a shadcn `Card` showing the overall `status` ('ok' → healthy styling, 'degraded' → degraded styling)
- [X] T012 [US1] Inside that `Card`, render one `Badge` per entry in `health.services` (`database`, `redis`), styled distinctly for `'ok'` vs `'error'` (spec FR-002, FR-003)
- [X] T013 [US1] Add a shadcn `Button` that re-runs the fetch function from T009, wired to the `isChecking` flag from T010 (disabled/pending affordance while checking) (spec FR-004)
- [X] T014 [US1] Add a distinct rendered state for the "API completely unreachable" case (fetch throws / network error) so it reads differently from a single degraded dependency (spec Edge Cases)

**Checkpoint**: User Story 1 fully functional and independently testable per quickstart.md steps 1–4.

---

## Phase 4: User Story 2 - Consistent, maintainable visual foundation (Priority: P2)

**Goal**: No hand-written CSS remains duplicating what Tailwind/shadcn now provide.

**Independent Test**: Inspect `apps/web/src/App.css` and `apps/web/src/index.css` — no rules remain that any current surface still depends on (spec Acceptance Scenario, SC-004).

### Implementation for User Story 2

- [X] T015 [US2] Remove the now-unused rules from `apps/web/src/App.css` (the `.app`, `.health`, `.error` selectors etc. superseded by Tailwind utility classes on the elements themselves in `App.tsx`); delete the file entirely if nothing remains, and remove its `import './App.css'` from `App.tsx`
- [X] T016 [US2] Confirm `apps/web/src/index.css` contains only the Tailwind import from T004 (no leftover Vite-template default styles)

**Checkpoint**: Both user stories work together; zero component-specific hand-written CSS remains (SC-004).

---

## Phase 5: Polish

- [X] T017 [P] Run `npm run lint -w @saas-pulse/web` and fix any resulting issues
- [X] T018 Execute quickstart.md end-to-end (healthy, degraded via `db:down`, unreachable via stopping the API, manual re-check) and confirm every listed outcome

---

## Dependencies & Execution Order

- **Setup (Phase 1)**: no dependencies, start immediately (T002/T003 can run in parallel with each other after T001)
- **Foundational (Phase 2)**: depends on Phase 1 (Tailwind must be configured before `shadcn init` runs); T006–T008 are parallel with each other after T005
- **User Story 1 (Phase 3)**: depends on Phase 2 (needs the `Card`/`Badge`/`Button` primitives); T009→T010→(T011,T012 parallel)→T013→T014
- **User Story 2 (Phase 4)**: depends on Phase 3 being visually complete (can't confirm CSS is unused until the restyle lands); T015→T016
- **Polish (Phase 5)**: depends on Phases 3 and 4

## Implementation Strategy

**MVP = Phase 1 → Phase 2 → Phase 3.** This alone satisfies spec Success
Criteria SC-001–SC-003. Phase 4 (CSS cleanup) and Phase 5 (polish) are quick
follow-ons that complete SC-004 and confirm nothing regressed.
