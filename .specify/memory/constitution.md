<!--
Sync Impact Report
- Version change: none → 1.0.0 (initial adoption)
- Modified principles: n/a (first ratification)
- Added sections: all (Core Principles I-V, Technology & Infrastructure Constraints,
  Development Workflow, Governance)
- Removed sections: none
- Templates requiring updates: none pending — plan/spec/tasks templates already
  reference "Constitution Check" generically and need no edits for this content.
- Follow-up TODOs: none
-->

# SaaS Pulse Constitution

## Core Principles

### I. Workspace Boundaries
The repo is an npm workspaces monorepo with exactly three packages: `apps/api`
(NestJS 11, Prisma 6, ioredis), `apps/web` (React 19 + Vite), and `packages/shared`
(request/response contracts and other types shared by both apps). Request/response
contracts MUST live in `packages/shared`, not be duplicated per-app. The API
imports shared types with `import type`. `packages/shared` is a build artifact for
the API's tsconfig `paths` resolution — after changing its source, `npm run
build:shared` MUST be run before the API build/dev picks up the change.

### II. NestJS Module Structure
Each feature is one NestJS module with its own controller and service. Global
modules are reserved for cross-cutting infrastructure only (`PrismaService`,
the Redis client) — a feature module MUST NOT be marked global to work around
a wiring problem.

### III. Code Style
API source uses single quotes and Prettier formatting (`npm run format` /
`npm run lint` in `apps/api`); these are enforced as written, not restyled
ad hoc.

### IV. Data Model Discipline
The `Server`, `Log`, and `User` Prisma models are currently commented out in
`schema.prisma` after an earlier migration dropped them. No feature may read,
write, or route around these models until they are deliberately restored in
`schema.prisma` and shipped via a new Prisma migration — reintroducing them is
itself the first step of any feature that needs them, not an incidental side
effect.

### V. Simplicity (YAGNI)
This is an early-stage, portfolio-facing project. Prefer the simplest thing
that works over speculative flexibility: no interfaces with a single
implementation, no config for values that never change, no abstractions or
infrastructure sized for load or scale this project doesn't have. A deliberate
simplification that cuts a real corner is left in place with a comment naming
the ceiling and the upgrade trigger, rather than solved preemptively.

## Technology & Infrastructure Constraints

Local development infrastructure (Postgres 15, Redis) runs via the root
`docker-compose.yml` on the non-default ports it already declares
(5442→Postgres, 6389→Redis) to avoid colliding with other local services. The
credentials in that file are local-development-only; real credentials MUST
NOT be hardcoded anywhere outside untracked local env files (`apps/api/.env`
or root `.env`). Any new service (containers, CI, cluster manifests) added to
this repo follows the same rule: secrets are injected via environment/secret
mechanisms appropriate to that context, never committed in plain text.

## Development Workflow

Changes to shared contracts start in `packages/shared`; a change is not
complete until `npm run build:shared` has been run and the API/web code that
consumes the new shape compiles. API changes are expected to pass `npm run
lint` and `npm run test` (`-w @saas-pulse/api`) before being considered done;
web changes pass `npm run lint` (`-w @saas-pulse/web`). New capabilities (a
CSS/design system, containerization, CI/CD, cluster infrastructure) are
introduced through the Spec Kit workflow (`/speckit-specify` →
`/speckit-plan` → `/speckit-tasks` → `/speckit-implement`) so each addition
has a readable spec/plan trail rather than landing as an opaque diff.

## Governance

This constitution supersedes ad hoc conventions for anything it covers.
Amendments are made by editing this file directly, bumping the version per
the rule below, and updating `Last Amended`. Versioning is semantic:
**MAJOR** for a backward-incompatible principle removal or redefinition,
**MINOR** for a new principle or materially expanded section, **PATCH** for
wording/clarification fixes. Every `/speckit-plan` run's Constitution Check
step is where compliance with this document gets verified for that feature;
unresolved violations MUST be simplified away or explicitly justified in that
plan's Complexity Tracking section, not silently merged.

**Version**: 1.0.0 | **Ratified**: 2026-09-27 | **Last Amended**: 2026-09-27
