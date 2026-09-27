# Phase 0 Research: Tailwind + shadcn/ui Styling System

No open `NEEDS CLARIFICATION` markers from the spec's Technical Context — this
is a standard, well-documented integration for the exact stack already in
`apps/web` (React 19 + Vite). Decisions below are settled, not open questions.

## Decision: Tailwind CSS v4 via the official Vite plugin

**Rationale**: Tailwind v4 ships a first-party `@tailwindcss/vite` plugin that
handles scanning + generation directly inside Vite's pipeline — no
`tailwind.config.js`, no `postcss.config.js`, no `autoprefixer` dependency.
Content is enabled with a single `@import "tailwindcss";` in the app's CSS
entrypoint (`index.css`).

**Alternatives considered**: the classic PostCSS setup (`postcss` +
`autoprefixer` + `tailwind.config.js`) — rejected as unnecessary ceremony
now that the Vite plugin covers the same ground with less config to maintain.

## Decision: shadcn/ui via its own CLI, added on top of Tailwind

**Rationale**: shadcn/ui is not an npm dependency — its CLI (`npx shadcn@latest
init`, then `add <component>`) copies component source directly into the repo
(under `apps/web/src/components/ui/`), so components are owned and editable
like any other project code, not a black-box library. It requires a `@/*` path
alias (resolved via `components.json`) and pulls in a handful of small,
already-standard peer packages (`class-variance-authority`, `clsx`,
`tailwind-merge`, `lucide-react`).

**Alternatives considered**: a pre-packaged component library (e.g. MUI,
Chakra) — rejected as heavier than needed for two/three primitives on a
single screen, and it would fight Tailwind's utility-first model rather than
sit on top of it.

## Decision: `@/*` path alias

**Rationale**: shadcn's CLI generates imports like `@/components/ui/button`
and its `init` step expects the alias to already resolve. Added in both
`apps/web/vite.config.ts` (`resolve.alias`) and `apps/web/tsconfig.app.json`
(`compilerOptions.paths`), pointing at `apps/web/src`.

**Alternatives considered**: relative imports (`../../components/ui/button`)
— rejected because it's the shadcn CLI's own default expectation and fighting
it just to avoid one alias isn't worth it.

## Decision: keep `HealthCheckResponse` fetch logic in `App.tsx`, unchanged

**Rationale**: FR-005 requires this feature to be presentation-only. The
existing `useEffect` fetch-on-mount against `/health` stays; the only
addition is wrapping the same fetch in a function callable both on mount and
from the new manual re-check button.

**Alternatives considered**: extracting a `useHealthCheck` hook — rejected
per the constitution's Simplicity principle; one component with one fetch
function needs no extraction until a second consumer exists.
