# Data Model: Account Authentication & Data Isolation

No schema change. This feature uses the existing `User` model from migration `20260927095043_init`.

## User (existing, `apps/api/prisma/schema.prisma`)

| Field | Type | Rules |
|-------|------|-------|
| `id` | String (cuid) | Primary key. Used as the token `sub`. |
| `email` | String, `@unique` | Trimmed and lower-cased before it is stored. Must be a valid email. |
| `name` | String? | Optional display name, 1–100 characters when present. |
| `password` | String | bcrypt hash only; never returned or logged. Plain text before hashing: at least 8 characters and at most 72 UTF-8 bytes. |
| `createdAt` / `updatedAt` | DateTime | Set automatically. |

Relation: `User 1 ─ * Monitor 1 ─ * Check`, with cascade deletes.

## Access token (not stored)

| Claim | Value |
|-------|-------|
| `sub` | `User.id` |
| `iat` / `exp` | Issued at / expires at. The lifetime comes from `JWT_EXPIRES_IN` (default `1d`). |

Signed with HS256 using `JWT_SECRET`. It is valid only if the signature and `exp` check out **and** the user with id `sub` still exists.

## Ownership rule (for Monitors, Checks and every future owned model)

- **Owned directly:** `Monitor.userId = currentUser.id`.
- **Owned through a parent:** `Check` belongs to a user through `Check.monitor.userId`. Queries filter with `where: { monitor: { userId } }`.
- **Missing and not-yours are the same:** a record that doesn't exist and a record owned by someone else both produce `404 Not Found`.
