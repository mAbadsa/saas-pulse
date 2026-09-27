# Implementation Plan: Tailwind + shadcn/ui Styling System

**Branch**: `001-tailwind-shadcn-styling` | **Date**: 2026-09-27 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-tailwind-shadcn-styling/spec.md`

## Summary

Replace `apps/web`'s hand-written `App.css`/`index.css` with Tailwind CSS v4
(via `@tailwindcss/vite`) and shadcn/ui, then restyle the existing
`/health`-backed status display with shadcn `Card`/`Badge`/`Button`
primitives — including a manual re-check button — with no change to routes,
pages, or the `HealthCheckResponse` data contract.

## Technical Context

**Language/Version**: TypeScript ~6.0 (existing `apps/web` config), React 19

**Primary Dependencies**: `tailwindcss` v4, `@tailwindcss/vite`; shadcn/ui
generated components + its peer deps (`class-variance-authority`, `clsx`,
`tailwind-merge`, `lucide-react`)

**Storage**: N/A (no data changes; reuses existing `/health` endpoint)

**Testing**: Manual verification via `npm run dev:web` + browser (per
quickstart.md) — this is a visual/styling change with no new business logic
to unit test; `npm run lint -w @saas-pulse/web` must still pass

**Target Platform**: Browser (Vite dev server + `vite build` output), same as today

**Project Type**: Web application (existing monorepo: `apps/api` + `apps/web` + `packages/shared`)

**Performance Goals**: N/A beyond not regressing existing page load

**Constraints**: Presentation-only change (spec FR-005) — no new endpoints,
no changes to `packages/shared`

**Scale/Scope**: Single existing screen (`App.tsx`); no new routes

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Workspace Boundaries**: No change to `packages/shared` or its contracts. PASS
- **II. NestJS Module Structure**: N/A — no API changes. PASS
- **III. Code Style**: Applies to API only; `apps/web` keeps its existing ESLint/Prettier-equivalent setup. PASS
- **IV. Data Model Discipline**: No Prisma models touched. PASS
- **V. Simplicity (YAGNI)**: Adds exactly the shadcn primitives needed (Card, Badge, Button) — no component library, no design-token abstraction layer. PASS

No violations — Complexity Tracking table not needed.

*Post-Phase-1 re-check*: data-model.md confirms no new persisted state beyond
one local `isChecking` boolean; still PASS on all five principles.

## Project Structure

### Documentation (this feature)

```text
specs/001-tailwind-shadcn-styling/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md         # Phase 1 output
└── tasks.md              # Phase 2 output (/speckit-tasks — not yet created)
```

No `contracts/` directory: this feature adds no new interface — it reuses the
existing `/health` HTTP contract and `HealthCheckResponse` shared type
unchanged.

### Source Code (repository root)

```text
apps/web/
├── vite.config.ts            # add @tailwindcss/vite plugin + @/* alias
├── tsconfig.app.json          # add @/* path mapping
├── components.json            # new — shadcn CLI config
├── src/
│   ├── index.css               # @import "tailwindcss"; (replaces most of current content)
│   ├── App.css                 # trimmed/removed — rules superseded by Tailwind utilities
│   ├── App.tsx                 # restyled health display + re-check button
│   └── components/ui/          # new — shadcn-generated primitives (button.tsx, card.tsx, badge.tsx)
│   └── lib/utils.ts             # new — shadcn's `cn()` helper (cva + tailwind-merge)
```

**Structure Decision**: Everything stays inside the existing `apps/web`
package — no new workspace package. shadcn's generated files land under
`apps/web/src/components/ui/` and `apps/web/src/lib/`, matching its own CLI
defaults, so future `shadcn add <component>` calls need no extra
configuration.

## Complexity Tracking

*No violations — table not applicable.*
