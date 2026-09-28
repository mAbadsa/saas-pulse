# Data Model: Monitors Management

No schema change. This feature uses the existing models from migration `20260927095043_init`.

## Monitor

| Field | Type | Set by | Rules |
|-------|------|--------|-------|
| `id` | String (cuid) | server | Never accepted from the client |
| `name` | String | client | Trimmed; 1–100 characters |
| `url` | String | client | Trimmed; absolute http/https; no `user:pass@`; ≤ 2,048 characters |
| `intervalSeconds` | Int, default 60 | client (optional) | Whole number, 30–86,400 |
| `isActive` | Boolean, default true | client (PATCH only) | `false` = paused |
| `status` | `PENDING` \| `UP` \| `DOWN`, default `PENDING` | server | This feature only sets or resets `PENDING` |
| `lastCheckedAt` | DateTime? | server | Cleared when the URL changes |
| `userId` | String → User | server | From `@CurrentUser()`; never in requests or responses |
| `createdAt` / `updatedAt` | DateTime | server | |

Indexes: `@@index([userId])`. Relations: `User` → `Monitor` → `Check`, each with `onDelete: Cascade`.

## State changes this feature makes

| Action | `isActive` | `status` | `lastCheckedAt` |
|--------|------------|----------|-----------------|
| Create | `true` | `PENDING` | `null` |
| PATCH `url` (different value) | unchanged | → `PENDING` | → `null` |
| PATCH `url` (same value), `name` or `intervalSeconds` | unchanged | unchanged | unchanged |
| PATCH `isActive: false` / `true` | → false / true | unchanged | unchanged |
| Delete | — (row removed; its `Check` rows cascade) | | |

`UP` and `DOWN` are set only by the future ping service.
