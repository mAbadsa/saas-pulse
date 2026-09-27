---
name: styling
description: Tailwind CSS v4 + shadcn/ui conventions for apps/web in this repo. Use when adding or changing UI in apps/web.
---

# Styling Conventions (apps/web)

Established by `specs/001-tailwind-shadcn-styling/` — see that folder (spec.md,
plan.md, research.md) for the full rationale.

## Stack

- **Tailwind CSS v4** via `@tailwindcss/vite` (already in `vite.config.ts`'s
  `plugins`). No `tailwind.config.js`, no `postcss.config.js`, no
  `autoprefixer` — v4 needs none of that.
- **shadcn/ui** ("Base UI" library, "Nova" preset) for component primitives.
  Generated files live in `apps/web/src/components/ui/` and
  `apps/web/src/lib/utils.ts` — they are project source, not a dependency;
  edit them directly like any other component.
- `apps/web/src/index.css` holds exactly one thing this repo controls:
  `@import 'tailwindcss';` — everything below it (CSS variables, `@theme`,
  dark mode) is shadcn's generated theme; don't hand-add plain CSS rules
  there or in a new stylesheet — style elements with Tailwind utility
  classes instead.

## Adding a new shadcn component

```bash
cd apps/web
npx shadcn@latest add <component>
```

**Known quirk in this environment**: the CLI sometimes resolves the `@/*`
alias incorrectly and writes files to a literal `apps/web/@/...` directory
instead of `apps/web/src/...`. After running `add`, check for a stray `./@`
directory at `apps/web/@`; if present, move its contents into the matching
`apps/web/src/...` path and delete the empty `@` directory before importing
anything from the new component.

## Path alias

`@/*` → `apps/web/src/*`, configured in both `apps/web/vite.config.ts`
(`resolve.alias`) and `apps/web/tsconfig.app.json` (`compilerOptions.paths`).
Both must stay in sync if the alias target ever changes.

## Patterns already in use (follow these, don't reinvent)

- Status/state badges: `<Badge variant="outline" className="text-green-600 dark:text-green-400 border-green-600/30">` for a healthy/positive state, `<Badge variant="destructive">` for an error/negative one — see `apps/web/src/App.tsx`'s `StatusBadge`. There's no built-in "success" variant on shadcn's `Badge`/`Button`, so healthy states get `variant="outline"` plus a green text/border override, not a new custom variant.
- A button that triggers an async re-fetch: track one local `isChecking`
  boolean, don't set it synchronously inside a mount `useEffect` body (trips
  the `react-hooks/set-state-in-effect` lint rule) — only set it from the
  click handler, and keep the shared fetch function itself free of
  `isChecking` writes.
- `eslint.config.js` disables `react-refresh/only-export-components` for
  `src/components/ui/**` — that's shadcn's own convention (exporting a `cva`
  variants map alongside the component), not a rule this repo relaxes
  elsewhere.
