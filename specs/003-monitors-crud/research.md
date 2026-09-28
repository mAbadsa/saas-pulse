# Research: Monitors Management

## 1. Pause/resume as PATCH vs dedicated endpoints

- **Decision:** `PATCH /monitors/:id` accepts `isActive: boolean` along with `name`, `url` and `intervalSeconds`.
- **Rationale:** `isActive` is a plain field on `Monitor`, so the same update path works. Setting it to the value it already has is naturally idempotent (FR-008), and there are two fewer routes to guard, test and document (Principle V).
- **Alternatives considered:** `POST /monitors/:id/pause` and `/resume`. They're more self-describing, but they duplicate the update path and add routes for no behavioural gain.

## 2. Isolation query pattern

- **Decision:** a private `findOwned(id, userId)` helper runs `prisma.monitor.findFirst({ where: { id, userId } })` and throws `NotFoundException` when the result is null.
  - **update:** `findOwned`, then `prisma.monitor.update({ where: { id } })`
  - **delete:** `prisma.monitor.deleteMany({ where: { id, userId } })`, then 404 if `count === 0`
- **Rationale:**
  - Update needs the current `url` to decide whether to reset the status (FR-007), so it reads first anyway.
  - `deleteMany` with the owner filter is a single atomic statement.
  - A malformed id is just a string that matches nothing, so FR-010 ("malformed id → 404") needs no separate id-format check.
- **Alternatives considered:** Prisma `update({ where: { id, userId } })` (filtering on non-unique fields, available since Prisma 5) plus catching `P2025`. That would be atomic, but it can't see the old URL.
- **Race note:** between `findOwned` and `update`, a concurrent delete by the same owner would make `update` throw `P2025`. That is mapped to 404 as well.

## 3. URL validation

- **Decision:** class-validator `@IsUrl({ protocols: ['http', 'https'], require_protocol: true, require_valid_protocol: true, require_tld: false, disallow_auth: true })` plus `@MaxLength(2048)`, after a trim `@Transform`.
- **Rationale:**
  - This covers FR-002: absolute URL, http(s) only, no `user:pass@`, at most 2,048 characters.
  - `require_tld: false` still allows `http://localhost:3000` for local development. Blocking private addresses is the ping service's job (spec Assumptions).

## 4. Interval

- **Decision:** `@IsInt() @Min(30) @Max(86400)` and optional on create. When omitted, the DB default `@default(60)` applies.
- **Rationale:** a single source for the default (the schema), and whole seconds keep the future scheduler simple.

## 5. Empty PATCH

- **Decision:** the service throws `BadRequestException('At least one field must be provided')` if none of the four fields is defined.
- **Rationale:** class-validator has no built-in "at least one property" rule, and a four-field check is one line.

## 6. Response shape

- **Decision:** a Prisma `select` returns only `id`, `name`, `url`, `intervalSeconds`, `isActive`, `status`, `lastCheckedAt`, `createdAt` and `updatedAt`, and never `userId`. Dates serialize to ISO strings.
- **Rationale:** the client already knows who it is, and leaving out `userId` avoids leaking internal ids.

## 7. Delete status code and cascade

- **Decision:** `DELETE` returns `204 No Content`. Removing check history relies on the existing `Check.monitor` relation with `onDelete: Cascade`, enforced by a DB foreign key in the `init` migration.
- **Rationale:** the database guarantees SC-004 even if the delete doesn't go through this service.
