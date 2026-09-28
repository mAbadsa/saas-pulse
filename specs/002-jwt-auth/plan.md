# Implementation Plan: Account Authentication & Data Isolation

**Branch**: `002-jwt-auth` | **Date**: 2026-09-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-jwt-auth/spec.md`

## Summary

Add email + password accounts to the NestJS API:
- register and login endpoints issue a signed JWT that expires after 1 day by default
- a **global guard** requires a valid JWT on every route, except routes explicitly marked `@Public()`
- a `@CurrentUser()` parameter decorator gives handlers the signed-in user

Passwords are hashed with bcrypt (`bcryptjs`). Input is validated by a global `ValidationPipe` that strips and rejects unknown fields. Request/response contracts live in `packages/shared`. Multi-tenant scoping comes down to one rule, "filter every owned-data query by `userId` from `@CurrentUser()`". It is documented here and applied by the Monitors feature.

## Technical Context

- **Language/Version**: TypeScript 5.7 on Node.js 24 (NestJS 11)
- **Primary Dependencies**:
  - existing: `@nestjs/*` 11, `@nestjs/config`, Prisma 6
  - new: `@nestjs/jwt` 11 (v12 is ESM-only and breaks Jest), `bcryptjs` 3, `class-validator` 0.15, `class-transformer` 0.5
- **Storage**: PostgreSQL 15 via Prisma. The existing `User` model needs no migration.
- **Testing**:
  - Jest unit tests (`src/**/*.spec.ts`) for `AuthService` and the guard
  - Jest + supertest e2e tests (`test/*.e2e-spec.ts`) against the local Docker database
- **Target Platform**: Linux server (Node.js), local Docker Compose for Postgres and Redis
- **Project Type**: web service (the API workspace of a monorepo)
- **Performance Goals**: register and login under 1 s (SC-006). bcrypt cost 10 takes about 60–80 ms.
- **Constraints**:
  - The app must refuse to start without `JWT_SECRET`.
  - No password or hash may appear in responses or logs.
  - A failed login must look identical whether or not the email exists, in both the response body and the response time.
- **Scale/Scope**: early-stage single-node app; 4 endpoints (`POST /auth/register`, `POST /auth/login`, `GET /auth/me`, plus making `/` and `/health` public)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Workspace Boundaries | ✅ Pass | `RegisterRequest`, `LoginRequest`, `AuthResponse` and `UserProfile` are defined in `packages/shared` and imported with `import type`. The API's class-validator DTOs `implements` the shared interfaces instead of duplicating them. *Out of date:* the principle says the API uses tsconfig `paths`; since commit `1c5a961` it reads `packages/shared/dist/`. The rule ("run `build:shared` after changing shared") still holds. |
| II. NestJS Module Structure | ✅ Pass | One `AuthModule` holds the controller, service, guard and decorators. The guard is registered with `APP_GUARD` inside `AuthModule`, so the module doesn't need to be `@Global()`. |
| III. Code Style | ✅ Pass | Single quotes, Prettier; `npm run lint` and `npm run test` must pass. |
| IV. Data Model Discipline | ✅ Pass | *Out of date:* the principle says `User` is commented out, but it was restored in the `init` migration (commit `5e236a8`), which is the "deliberate restoration" the principle asks for. This feature uses `User` as it is, with no schema change. |
| V. Simplicity (YAGNI) | ✅ Pass | No Passport (a plain guard with `JwtService` does the job). No refresh tokens, no separate `UsersModule` or users service, no repository layer, no token denylist. Corners cut on purpose are listed below. |

**Deliberate simplifications (Principle V):**
- **Guard hits the database on every request:** one indexed lookup by primary key, done to satisfy FR-011 (a deleted user's token is rejected). Upgrade path: cache the user in Redis or trust the token's claims, if the lookup ever shows up in profiling.
- **No rate limiting on login:** noted as a follow-up in the spec's assumptions; add `@nestjs/throttler` before any public deployment.

**Post-design re-check:** ✅ Still passing after Phase 1. The design adds one module and 4 new dependencies, and no abstraction has only one implementation.

## Project Structure

### Documentation (this feature)

```text
specs/002-jwt-auth/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── auth-api.md
└── tasks.md             # created by /speckit-tasks
```

### Source Code (repository root)

```text
packages/shared/src/
└── index.ts                  # + RegisterRequest, LoginRequest, UserProfile, AuthResponse

apps/api/src/
├── app.module.ts             # + AuthModule, global ValidationPipe via APP_PIPE
├── app.controller.ts         # @Public() on / and /health
└── auth/
    ├── auth.module.ts        # JwtModule.registerAsync (JWT_SECRET required), APP_GUARD
    ├── auth.controller.ts    # POST /auth/register, POST /auth/login, GET /auth/me
    ├── auth.service.ts       # register, login, hashing, token issuing, P2002 → 409
    ├── auth.guard.ts         # Bearer check, verify token, load user, attach to request
    ├── auth.decorators.ts    # @Public(), @CurrentUser()
    ├── auth.dto.ts           # RegisterDto, LoginDto (class-validator)
    └── auth.service.spec.ts  # unit tests

apps/api/test/
├── app.e2e-spec.ts           # fix: expects 'SaaS Pulse API' (currently asserts 'Hello World!' and fails)
└── auth.e2e-spec.ts          # register / login / me / guard / public routes

.env.example                  # + JWT_SECRET, JWT_EXPIRES_IN
```

**Structure Decision**: the existing monorepo layout is kept. Everything for this feature goes in one new NestJS feature folder, `apps/api/src/auth/`, plus contract types in `packages/shared`. Decorators share one file and DTOs share another, because each file would otherwise hold only a few lines.

## Complexity Tracking

No violations, so nothing to justify.
