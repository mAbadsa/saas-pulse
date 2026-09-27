# Implementation Plan: Monitors Management

**Branch**: `003-monitors-crud` | **Date**: 2026-09-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-monitors-crud/spec.md`

## Summary

Add a `MonitorsModule` to the API with five routes: `POST /monitors`, `GET /monitors`, `GET /monitors/:id`, `PATCH /monitors/:id` and `DELETE /monitors/:id`. Pause and resume are part of `PATCH` (`{ "isActive": false | true }`) instead of separate endpoints (research §1).

- **Protection and isolation:** every route is protected by the existing global `AuthGuard`. Every query is scoped with `userId` from `@CurrentUser()` (Constitution VI), and a record owned by someone else is indistinguishable from a missing one (404).
- **Validation:** handled by class-validator DTOs that `implements` the new shared contracts.
- **URL change:** changing the URL resets `status` to `PENDING` and `lastCheckedAt` to null.
- **Delete:** relies on the existing `onDelete: Cascade` relation from `Check` to `Monitor`.
- **Schema:** no change.

## Technical Context

- **Language/Version**: TypeScript 5.7, Node.js 24, NestJS 11
- **Primary Dependencies**: existing only (Prisma 6, class-validator/class-transformer, the auth module from 002). No new packages.
- **Storage**: PostgreSQL through Prisma. The `Monitor` and `Check` models already exist, so there's no migration.
- **Testing**: Jest e2e tests (`apps/api/test/monitors.e2e-spec.ts`) against the local Docker DB, including two-user isolation tests. No unit tests for the service, because the logic is thin Prisma calls and the e2e tests cover every branch.
- **Target Platform**: Linux server (Node.js)
- **Project Type**: web service (the API workspace of a monorepo)
- **Performance Goals**: under 1 s per operation with up to 100 monitors per user (SC-005). Each operation is one or two indexed queries (`Monitor.userId` is indexed).
- **Constraints**:
  - Owner, id, status and `lastCheckedAt` can never be set by the client.
  - The response never includes `userId`.
- **Scale/Scope**: 5 routes, 1 module, 4 shared types

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Workspace Boundaries | ✅ | `MonitorResponse`, `CreateMonitorRequest`, `UpdateMonitorRequest` and `MonitorStatus` go in `packages/shared`. The DTOs `implements` them. |
| II. NestJS Module Structure | ✅ | One `MonitorsModule` with a controller and a service; not global. |
| III. Code Style | ✅ | Must pass lint (config from 002). |
| IV. Data Model Discipline | ✅ | Uses the existing `Monitor` and `Check` models; no schema change, so no migration. |
| V. Simplicity | ✅ | Pause and resume fold into `PATCH`. No pagination, no quota, no service unit tests beyond e2e, no repository layer. |
| VI. Auth & Tenant Isolation | ✅ | Every Prisma call includes `userId`. Not-owned records return 404. `userId`, `status` and `lastCheckedAt` aren't in any DTO, so the whitelist rejects them. The e2e tests use two users. The guard-rail test automatically covers the 5 new routes. |

**Post-design re-check:** ✅ No violations.

## Project Structure

### Documentation (this feature)

```text
specs/003-monitors-crud/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/monitors-api.md
└── tasks.md
```

### Source Code

```text
packages/shared/src/index.ts           # + MonitorStatus, MonitorResponse, CreateMonitorRequest, UpdateMonitorRequest

apps/api/src/
├── app.module.ts                      # + MonitorsModule
└── monitors/
    ├── monitors.module.ts
    ├── monitors.controller.ts         # 5 routes, @CurrentUser() on each
    ├── monitors.service.ts            # userId-scoped Prisma calls, URL-change reset
    └── monitors.dto.ts                # CreateMonitorDto, UpdateMonitorDto

apps/api/test/
└── monitors.e2e-spec.ts               # CRUD, validation, pause/resume, cascade delete, two-user isolation
```

**Structure Decision**: one feature folder that mirrors `src/auth/`.

## Complexity Tracking

No violations.
