# Implementation Plan: Ping Service

**Branch**: `004-ping-service` | **Date**: 2026-09-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-ping-service/spec.md`

## Summary

Add a `PingModule` to the API. A `setInterval` loop, started when the app boots and cleared when it shuts down, runs a cycle every 10 s:

1. **Find due monitors:** a single raw SQL query selects active monitors where `lastCheckedAt IS NULL` or `lastCheckedAt + intervalSeconds <= now()`, oldest first, up to 100.
2. **Check them:** in chunks of 10, each one gets a single GET through Node's `http`/`https`, with no redirect following and the body thrown away. SSRF is blocked by a custom DNS `lookup` hook that rejects any resolved address found in a `net.BlockList`. IP literals, which skip DNS, are checked against the same list before connecting.
3. **Record the result:** in one transaction, a guarded `updateMany({ where: { id, url } })` (skipped if the monitor was deleted or its URL changed) followed by `check.create`.

There's no new npm dependency (research §1).

## Technical Context

- **Language/Version**: TypeScript 5.9, Node.js 24, NestJS 11
- **Primary Dependencies**: Node standard library only (`node:http`, `node:https`, `node:dns`, `node:net`) plus existing Prisma
- **Storage**: PostgreSQL through Prisma. The existing `Check` and `Monitor` models need no migration.
- **Testing**:
  - Jest unit tests for `isBlockedAddress`
  - Jest e2e tests that start local `http` servers on `127.0.0.1` (with private targets allowed) and call `PingService.runCycle()` directly, with the timer disabled
  - SSRF e2e tests with private targets *disallowed*, using a local server to prove no connection is made
- **Target Platform**: Linux server, single instance
- **Project Type**: web service (the API workspace)
- **Performance Goals**: SC-001/SC-002 need a check within 15 s of being due, met by a 10 s cycle and a 10 s timeout. Chunks of 10 mean a stuck site delays its own chunk by at most the timeout (SC-005).
- **Constraints**:
  - no connection to non-public IPs, checked at connect time
  - cycles never overlap
  - clean shutdown (no open handles in Jest)
- **Scale/Scope**: up to 100 monitors per cycle (about 600 per minute). The `ponytail:` comments note the limit and the upgrade path, a queue.

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Workspace Boundaries | ✅ | No new API contract, so `packages/shared` is unchanged. The `Check` data isn't exposed yet. |
| II. NestJS Module Structure | ✅ | One `PingModule` (a service, no controller); not global. |
| III. Code Style | ✅ | Must pass lint. |
| IV. Data Model Discipline | ✅ | No schema change. Writes only `Check` rows and `Monitor.status`/`lastCheckedAt`. |
| V. Simplicity | ✅ | `setInterval` instead of `@nestjs/schedule`; `net.BlockList` instead of an IP library; chunked `Promise.allSettled` instead of a concurrency library. No Redis cache yet (spec Assumptions). Single-instance limits are marked with `ponytail:` comments. |
| VI. Auth & Tenant Isolation | ✅ | No new routes. The service works across all users by design; it's system work, not a per-user endpoint. Results are written only to the checked monitor, found by `id`. |

**Post-design re-check:** ✅

## Project Structure

```text
apps/api/src/
├── app.module.ts            # + PingModule
└── ping/
    ├── ping.module.ts
    ├── ping.service.ts      # interval lifecycle, runCycle(), recordResult()
    ├── http-check.ts        # checkUrl(url, { timeoutMs, allowPrivate }) → CheckResult; SSRF lookup
    ├── blocked-addresses.ts # BlockList + isBlockedAddress()
    └── blocked-addresses.spec.ts

apps/api/test/
└── ping.e2e-spec.ts         # up / 500 / timeout / refused / due-ness / paused / SSRF / URL-changed race

.env.example                 # + PING_ENABLED, PING_ALLOW_PRIVATE, PING_TIMEOUT_MS
```

**Structure Decision**: one feature folder. The HTTP check and the address blocklist are separate pure modules so they can be tested without Nest.

## Complexity Tracking

No violations.
