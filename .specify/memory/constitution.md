# SaaS Pulse Constitution

## Core Principles

### I. Workspace Boundaries

The repo is an npm workspaces monorepo with exactly three packages:
- `apps/api` (NestJS 11, Prisma 6, ioredis)
- `apps/web` (React 19 + Vite)
- `packages/shared` (request/response contracts and other types shared by both apps)

Request/response contracts MUST live in `packages/shared` and MUST NOT be duplicated per app. The API imports shared types with `import type`, and its DTO classes `implements` the shared interfaces rather than redefining them.

The two apps resolve the shared package differently:
- The API resolves `@saas-pulse/shared` as a normal workspace package from `packages/shared/dist`. `npm run dev:api` builds shared first. After changing shared types while the API is running, `npm run build:shared` MUST be run before the API picks up the change.
- The web app reads the shared source directly through a Vite alias.

### II. NestJS Module Structure

Each feature is one NestJS module with its own controller and service. Global modules are reserved for cross-cutting infrastructure (`PrismaService`, the Redis client). A feature module MUST NOT be marked `@Global()` to work around a wiring problem. App-wide behaviour (the auth guard, the validation pipe) is registered with `APP_GUARD` / `APP_PIPE` instead.

### III. Code Style

API source uses single quotes and Prettier formatting, enforced by `apps/api/eslint.config.mjs` and `apps/api/.prettierrc` (`npm run lint` / `npm run format` in `apps/api`). These rules are applied as written, not restyled ad hoc.

### IV. Data Model Discipline

`apps/api/prisma/schema.prisma` is the single source of truth for the data model. The current models are `User`, `Monitor` (with `MonitorStatus` `PENDING` | `UP` | `DOWN`) and `Check`, created by the `init` migration.

Every schema change MUST ship as a new Prisma migration committed alongside the change (`npm run prisma:migrate`). Editing an applied migration, using `prisma db push`, or changing the database by hand are all forbidden. Pausing a monitor is `Monitor.isActive = false`, not a status value.

### V. Simplicity (YAGNI)

This is an early-stage, portfolio-facing project. Prefer the simplest thing that works over speculative flexibility:
- no interfaces with a single implementation
- no config for values that never change
- no abstractions or infrastructure sized for load or scale this project doesn't have

A deliberate simplification that cuts a real corner is left in place with a comment naming the ceiling and the upgrade trigger, rather than solved preemptively.

### VI. Auth & Tenant Isolation

Every API route requires a valid Bearer token. The global `AuthGuard` enforces this, and the only opt-out is an explicit `@Public()`. Handlers get the caller with `@CurrentUser()` and MUST NOT parse tokens themselves.

Every read, update or delete of user-owned data MUST filter by the caller's id:
- `where: { id, userId }` for a Monitor
- `where: { monitor: { userId } }` for a Check

A record owned by another user MUST return 404, exactly like a missing one. `userId` MUST come from `@CurrentUser()` and never from the request body; the global `ValidationPipe` rejects unknown body fields.

Any feature that adds owned-data endpoints MUST include e2e tests with two users proving cross-user reads, updates and deletes all fail. The existing guard-rail e2e test, which requires every non-`@Public()` route to return 401 without a token, MUST keep passing.

## Technology & Infrastructure Constraints

Local development infrastructure (Postgres 15, Redis) runs through the root `docker-compose.yml`, on the non-default ports it declares (5442→Postgres, 6389→Redis) to avoid clashing with other local services. The credentials in that file are for local development only.

Real secrets, including `JWT_SECRET`, MUST NOT be hardcoded or committed anywhere. They live only in untracked env files (`apps/api/.env` or the root `.env`). `.env.example` holds placeholders only. Any new service added to this repo (containers, CI, cluster manifests) follows the same rule: secrets are injected through the environment or secret mechanism suited to that context, never committed in plain text.

## Development Workflow

Changes to shared contracts start in `packages/shared`. A change is not complete until `npm run build:shared` has been run and the API and web code that use the new shape compile.

Before an API change counts as done, it MUST pass `npm run lint`, `npm run test` and `npm run test:e2e` (all with `-w @saas-pulse/api`; e2e needs `npm run db:up`). Web changes MUST pass `npm run lint` (`-w @saas-pulse/web`).

New capabilities (a feature, a design system, containerization, CI/CD, cluster infrastructure) are introduced through the Spec Kit workflow (`/speckit-specify` → `/speckit-plan` → `/speckit-tasks` → `/speckit-implement`), so each addition leaves a readable spec and plan trail instead of landing as an opaque diff.

## Governance

This constitution overrides informal conventions for anything it covers.

To amend it, edit this file directly, bump the version according to the rule below, and update `Last Amended`. Versioning is semantic:
- **MAJOR**: a principle removed or redefined in a backward-incompatible way
- **MINOR**: a new principle or a materially expanded section
- **PATCH**: wording or clarification fixes

Compliance is checked for each feature in the Constitution Check step of its `/speckit-plan` run. Unresolved violations MUST be simplified away or explicitly justified in that plan's Complexity Tracking section, never merged silently.

**Version**: 1.1.0 | **Ratified**: 2026-09-27 | **Last Amended**: 2026-09-27
