---

description: "Task list for 002-jwt-auth"
---

# Tasks: Account Authentication & Data Isolation

**Input**: Design documents from `/specs/002-jwt-auth/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/auth-api.md, quickstart.md

**Tests**: Included. SC-002 and SC-003 require automated tests, and the constitution requires `npm run test` to pass.

**Organization**: tasks are grouped by user story. All API paths are relative to `apps/api/`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no unfinished dependencies)
- **[Story]**: US1 = Register, US2 = Sign in, US3 = Protected access, US4 = Data isolation

---

## Phase 1: Setup

- [X] T001 Install API dependencies: `npm install -w @saas-pulse/api @nestjs/jwt bcryptjs class-validator class-transformer` (updates `apps/api/package.json` and `package-lock.json`)
- [X] T002 [P] Add `JWT_SECRET=change-me-generate-with-openssl-rand-hex-32` and `JWT_EXPIRES_IN=1d` (under an `# Auth` comment) to `.env.example`, and add a real `JWT_SECRET` (from `openssl rand -hex 32`) plus `JWT_EXPIRES_IN=1d` to the untracked `apps/api/.env`
- [X] T003 [P] Fix the existing e2e assertion `.expect('Hello World!')` → `.expect('SaaS Pulse API')` in `apps/api/test/app.e2e-spec.ts`

---

## Phase 2: Foundational (blocks all stories)

- [X] T004 [P] Add the shared contracts to `packages/shared/src/index.ts`, exactly as in contracts/auth-api.md:
  - `RegisterRequest { email: string; password: string; name?: string }`
  - `LoginRequest { email: string; password: string }`
  - `UserProfile { id: string; email: string; name: string | null }`
  - `AuthResponse { accessToken: string; user: UserProfile }`

  Then run `npm run build:shared`.
- [X] T005 [P] Create `apps/api/src/auth/auth.decorators.ts`:
  - `IS_PUBLIC_KEY` and `Public = () => SetMetadata(IS_PUBLIC_KEY, true)`
  - `CurrentUser = createParamDecorator((_, ctx) => ctx.switchToHttp().getRequest().user)`, returning a `UserProfile`
- [X] T006 Register a global validation pipe in `apps/api/src/app.module.ts`:
  - providers: `{ provide: APP_PIPE, useValue: new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }) }`
  - It goes in the module, not `main.ts`, so e2e tests get the same pipe (research §8).
- [X] T007 Create `apps/api/src/auth/auth.module.ts`:
  - imports `JwtModule.registerAsync({ inject: [ConfigService], useFactory: (c) => ({ secret: c.getOrThrow('JWT_SECRET'), signOptions: { expiresIn: c.get('JWT_EXPIRES_IN', '1d') } }) })`
  - provides `AuthService` and `{ provide: APP_GUARD, useClass: AuthGuard }`
  - The module is **not** `@Global()`.
  - Add `AuthModule` to the `imports` in `apps/api/src/app.module.ts`.

**Checkpoint:** the shared types build, and the app refuses to start without `JWT_SECRET`.

---

## Phase 3: User Story 1 – Create an account (P1) 🎯 MVP

**Goal:** `POST /auth/register` creates a user and returns an `AuthResponse`.

**Independent test:** register a new email and get 201 with `accessToken` and `user`, with no `password` field. Registering the same email in a different case gets 409.

- [X] T008 [P] [US1] Create `RegisterDto implements RegisterRequest` in `apps/api/src/auth/auth.dto.ts`:
  - `email`: `@Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value)`, then `@IsEmail()`
  - `password`: `@IsString() @MinLength(8)`, plus a custom `@MaxBytes(72)` validator (defined in the same file) that checks `Buffer.byteLength(value, 'utf8') <= 72` with the message `password must be at most 72 bytes`
  - `name`: `@IsOptional() @IsString() @Length(1, 100)`
- [X] T009 [US1] Implement `AuthService.register(dto)` in `apps/api/src/auth/auth.service.ts`:
  - hash the password with `bcrypt.hash(dto.password, 10)` (from `bcryptjs`)
  - `prisma.user.create({ data: { email, name, password: hash } })`
  - catch `Prisma.PrismaClientKnownRequestError` with code `P2002` and throw `ConflictException('Email already in use')`
  - return `this.issue(user)`, where the private helper `issue(user)` returns `{ accessToken: await jwt.signAsync({ sub: user.id }), user: { id, email, name } }`. It must never include `password`.
- [X] T010 [US1] Add `@Public() @Post('register')`, which returns `authService.register(dto)` (status 201), to `AuthController` in `apps/api/src/auth/auth.controller.ts`, and register the controller in `auth.module.ts`
- [X] T011 [P] [US1] Unit tests in `apps/api/src/auth/auth.service.spec.ts`, with Prisma and JwtService mocked:
  - register hashes the password (the stored value ≠ the plain text, and `bcrypt.compare` is true)
  - the response has no `password` key
  - a P2002 error becomes `ConflictException`
- [X] T012 [US1] E2E tests in `apps/api/test/auth.e2e-spec.ts`, using a unique email per run (`` `e2e-${Date.now()}@example.com` ``) and deleting those users in `afterAll`:
  - 201 with a correct shape and no `password`
  - an email padded with spaces and in mixed case is stored lower-cased
  - a duplicate in a different case → 409
  - an invalid email, a password of 7 characters, a password over 72 bytes, or an extra field `id` → 400

**Checkpoint:** US1 works on its own.

---

## Phase 4: User Story 2 – Sign in (P1)

**Goal:** `POST /auth/login` returns an `AuthResponse`, and every failure gets the same 401.

**Independent test:** after registering, logging in gets 200. A wrong password and an unknown email get identical 401 bodies.

- [X] T013 [P] [US2] Add `LoginDto implements LoginRequest` to `apps/api/src/auth/auth.dto.ts`: `email` with the same trim + lower-case `@Transform` and `@IsEmail()`; `password` with `@IsString() @IsNotEmpty()`
- [X] T014 [US2] Implement `AuthService.login(dto)` in `apps/api/src/auth/auth.service.ts`:
  - `findUnique({ where: { email } })`
  - always call `bcrypt.compare(dto.password, user?.password ?? DUMMY_HASH)`. `DUMMY_HASH` is a module-level constant made with `bcrypt.hashSync('dummy-password', 10)`, so response time is similar whether or not the email exists (research §5).
  - if there is no user or the passwords don't match, throw `UnauthorizedException('Invalid email or password')`
  - otherwise return `this.issue(user)`
- [X] T015 [US2] Add `@Public() @Post('login') @HttpCode(200)` to `AuthController` in `apps/api/src/auth/auth.controller.ts`
- [X] T016 [P] [US2] Unit tests in `apps/api/src/auth/auth.service.spec.ts`: a correct password returns a token; a wrong password and an unknown email both throw `UnauthorizedException` with the same message; `bcrypt.compare` is called even when no user is found
- [X] T017 [US2] E2E tests in `apps/api/test/auth.e2e-spec.ts`: login gets 200 (with the email in any case); a wrong password and an unknown email get 401 with **deep-equal** bodies

**Checkpoint:** US1 and US2 work.

---

## Phase 5: User Story 3 – Protected access as yourself (P1)

**Goal:** every route requires a valid token unless it is `@Public()`, and `GET /auth/me` returns the caller's profile.

**Independent test:** `/auth/me` with a token gets 200; with no token, a malformed one, a tampered one, an expired one, or one for a deleted user, it gets 401. `/` and `/health` get 200 without a token.

- [X] T018 [US3] Create `AuthGuard implements CanActivate` in `apps/api/src/auth/auth.guard.ts`:
  - if `reflector.getAllAndOverride(IS_PUBLIC_KEY, [handler, class])` is set, return true
  - read the `Authorization` header and require the form `Bearer <token>`; anything else → `UnauthorizedException()`
  - `jwt.verifyAsync(token)`; any error → `UnauthorizedException()`
  - `prisma.user.findUnique({ where: { id: payload.sub }, select: { id, email, name } })`; if null → `UnauthorizedException()`
  - set `request.user` to that profile
  - add the comment `// ponytail: DB lookup per request to reject deleted users; cache in Redis if it shows up in profiling`
- [X] T019 [US3] Mark `getHello` and `getHealth` in `apps/api/src/app.controller.ts` with `@Public()`
- [X] T020 [US3] Add `@Get('me') me(@CurrentUser() user: UserProfile): UserProfile { return user; }` to `apps/api/src/auth/auth.controller.ts`
- [X] T021 [US3] E2E tests in `apps/api/test/auth.e2e-spec.ts`:
  - `/auth/me` with a valid token → 200 with the profile
  - no header, `Token abc`, a tampered signature, an expired token (signed with `JwtService` using `expiresIn: '-1s'`), or a token for a user deleted during the test → 401
  - `GET /` and `GET /health` without a token → 200

**Checkpoint:** US1–US3 together make the complete auth MVP.

---

## Phase 6: User Story 4 – Users only see their own data (P2)

**Goal:** establish the ownership rule for Monitors and Checks. There are no monitor endpoints yet, so this phase documents the rule and adds a guard-rail test. The Monitors feature proves it end to end.

**Independent test:** the meta-test in T023 passes. Once Monitors CRUD exists, its two-user isolation tests (SC-003) pass.

- [X] T022 [US4] Add an "Auth & data isolation" subsection under Conventions in `CLAUDE.md` with these rules:
  - every route is protected unless it is `@Public()`
  - get the caller with `@CurrentUser()`
  - every query on owned data filters by `userId`: `where: { id, userId }` for a Monitor, `where: { monitor: { userId } }` for a Check
  - a record that belongs to someone else returns 404, the same as a missing one
  - `userId` always comes from `@CurrentUser()`, never from the request body
- [X] T023 [US4] E2E guard-rail test in `apps/api/test/auth.e2e-spec.ts` (SC-002):
  - list every route with Nest's `DiscoveryService` + `MetadataScanner`, or read `app.getHttpAdapter().getInstance()._router.stack` for Express
  - assert that every route not in the allowlist `['GET /', 'GET /health', 'POST /auth/register', 'POST /auth/login']` returns 401 without a token
  - new endpoints added later, such as monitors, are covered automatically

---

## Phase 7: Polish & cross-cutting

- [X] T024 [P] Add the auth endpoints and the `JWT_SECRET` / `JWT_EXPIRES_IN` variables to the API and Environment tables in `README.md`, and add `JWT_SECRET` to the Environment block in `CLAUDE.md`
- [X] T025 Run `npm run lint`, `npm run test` and `npm run test:e2e` with `-w @saas-pulse/api`, plus `npm run build`, and fix any failures
- [X] T026 Walk through `specs/002-jwt-auth/quickstart.md` against the running API and confirm every expected status code

---

## Dependencies & Execution Order

- **Setup (T001–T003)** → **Foundational (T004–T007)** → the user stories.
- **US1 (T008–T012):** needs Foundational only.
- **US2 (T013–T017):** needs `issue()` from T009 and the controller from T010.
- **US3 (T018–T021):** needs Foundational. Its e2e tests need tokens from US1/US2.
- **US4 (T022–T023):** needs the US3 guard.
- **Polish (T024–T026):** needs all stories.

Within a story, write the tests (T011, T016) next to the service and run them before moving on.

## Parallel Examples

- **Setup:** T002 ∥ T003
- **Foundational:** T004 ∥ T005, then T006 → T007
- **US1:** T008 ∥ T011 (DTO and test scaffolding), then T009 → T010 → T012
- **US2:** T013 ∥ T016
- **Polish:** T024 ∥ T025

## Implementation Strategy

- **MVP:** Phases 1–5 (US1–US3). This alone delivers working, protected-by-default authentication.
- **Increment:** Phase 6 (US4) is cheap: a doc update plus the guard-rail test. The main payoff arrives with the Monitors feature.
- Stop at each checkpoint and confirm the story works on its own before starting the next.

## Implementation Notes (deviations from the plan)

- **`@nestjs/jwt` pinned to v11:** v12 is ESM-only, and Jest (CommonJS here) can't load it.
- **Empty `JWT_SECRET` rejected too:** `getOrThrow` only catches a *missing* variable, so `auth.module.ts` also rejects an empty one (edge case: "no default or empty secret").
- **API lint was broken before this feature:** `npm run lint` had no config. Added the standard NestJS 11 `eslint.config.mjs` + `.prettierrc`, and `test/tsconfig.json` so the type-aware lint can parse the e2e tests. `eslint --fix` also changed `bootstrap()` → `void bootstrap()` in `main.ts`.
- **Can't test the missing-secret case by running the app locally:** the Prisma client loads `apps/api/.env` into `process.env` by itself, so the secret gets in even when ConfigModule's env files are absent. The empty-value path was verified instead (`JWT_SECRET= node dist/main.js` exits with "JWT_SECRET must not be empty").
