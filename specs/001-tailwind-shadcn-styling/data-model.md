# Phase 1 Data Model: Tailwind + shadcn/ui Styling System

This feature is presentation-only (spec FR-005): it introduces no new data
shapes and changes no existing ones.

## Health Check Response (existing, reused as-is)

Defined in `packages/shared/src/index.ts`, already consumed by
`apps/web/src/App.tsx`:

| Field | Type | Notes |
|---|---|---|
| `status` | `'ok' \| 'degraded'` | overall status, drives the top-level indicator |
| `timestamp` | `string` | not displayed by this feature |
| `services.database` | `'ok' \| 'error'` | per-dependency status |
| `services.redis` | `'ok' \| 'error'` | per-dependency status |

No changes to `packages/shared` are required or made by this feature.

## UI-only state (component-local, not persisted)

`App.tsx` already holds `health: HealthCheckResponse | null` and
`error: string | null` in component state. This feature adds one more
component-local flag so the re-check button can show a pending state without
blanking the previously-displayed result (spec Edge Cases):

| Field | Type | Purpose |
|---|---|---|
| `isChecking` | `boolean` | true while a re-check fetch is in flight; existing `health`/`error` stay rendered underneath |
