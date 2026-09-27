# Quickstart: Verify Tailwind + shadcn/ui Styling

## Prerequisites

- Local Postgres/Redis running: `npm run db:up` (repo root)
- API and web dev servers available

## Run

```bash
npm run dev:api
```

```bash
npm run dev:web
```

Open `http://localhost:5173`.

## Expected outcomes (maps to spec Success Criteria)

1. **SC-001 / SC-002**: With `db:up` running, the page shows an overall
   healthy indicator plus a distinct status for each of `database` and
   `redis`, styled with shadcn `Card`/`Badge` components (no raw JSON on
   screen).
2. **SC-003**: Clicking the re-check button re-fetches `/health` and updates
   the displayed status without a full page reload; the previous status stays
   visible while the request is in flight (no blank/flash state).
3. **Degraded case**: `npm run db:down` (stops Postgres + Redis), then click
   re-check — the overall indicator and the affected dependency badges switch
   to their degraded/error visual treatment.
4. **Unreachable case**: stop the API process entirely, click re-check — the
   page shows a clear "unable to reach the system" state, not a blank screen.
5. **SC-004**: `apps/web/src/App.css` contains no rules this feature's
   surfaces still depend on (verified by inspection during implementation).
