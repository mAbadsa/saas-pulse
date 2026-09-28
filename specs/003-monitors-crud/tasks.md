---

description: "Task list for 003-monitors-crud"
---

# Tasks: Monitors Management

**Input**: Design documents from `/specs/003-monitors-crud/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/monitors-api.md

**Tests**: Included. SC-002 through SC-004 need automated checks, and Constitution VI requires two-user e2e tests.

**Stories**:
- US1 Create
- US2 List/View
- US3 Update
- US4 Pause/Resume
- US5 Delete
- US6 Isolation

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

No new dependencies and no migration. Nothing to set up.

---

## Phase 2: Foundational

- [X] T001 [P] Add these to `packages/shared/src/index.ts`, exactly as in contracts/monitors-api.md, then run `npm run build:shared`:
  - `MonitorStatus = 'PENDING' | 'UP' | 'DOWN'`
  - `MonitorResponse { id; name; url; intervalSeconds; isActive; status; lastCheckedAt: string | null; createdAt: string; updatedAt: string }`
  - `CreateMonitorRequest { name; url; intervalSeconds? }`
  - `UpdateMonitorRequest { name?; url?; intervalSeconds?; isActive? }`
- [X] T002 Create `apps/api/src/monitors/monitors.module.ts` (controller + service, not global) and add `MonitorsModule` to the `imports` in `apps/api/src/app.module.ts`
- [X] T003 Create `MonitorsService` in `apps/api/src/monitors/monitors.service.ts`:
  - a `SELECT` constant listing the 9 response fields (**no `userId`**)
  - a private `findOwned(id, userId)` that runs `prisma.monitor.findFirst({ where: { id, userId }, select: SELECT })` and throws `NotFoundException('Monitor not found')` when the result is null

**Checkpoint:** `npm run build -w @saas-pulse/api` compiles.

---

## Phase 3: US1 – Create (P1) 🎯 MVP

- [X] T004 [P] [US1] `CreateMonitorDto implements CreateMonitorRequest` in `apps/api/src/monitors/monitors.dto.ts`:
  - `name`: trim `@Transform`, `@IsString() @Length(1, 100)`
  - `url`: trim `@Transform`, `@IsUrl({ protocols: ['http','https'], require_protocol: true, require_valid_protocol: true, require_tld: false, disallow_auth: true }) @MaxLength(2048)`
  - `intervalSeconds`: `@IsOptional() @IsInt() @Min(30) @Max(86400)`
- [X] T005 [US1] `MonitorsService.create(userId, dto)`: `prisma.monitor.create({ data: { ...dto, userId }, select: SELECT })`. The DB defaults provide `PENDING`, `isActive: true` and interval 60.
- [X] T006 [US1] `MonitorsController` (`@Controller('monitors')`) in `apps/api/src/monitors/monitors.controller.ts`: `@Post()` → `create(@CurrentUser() user, @Body() dto)`, returning 201
- [X] T007 [US1] E2E tests in `apps/api/test/monitors.e2e-spec.ts`. Setup: register users A and B with unique emails in `beforeAll`, and delete them in `afterAll` (monitors cascade). Tests:
  - create → 201 with the defaults (`PENDING`, `isActive: true`, `intervalSeconds: 60`, `lastCheckedAt: null`) and no `userId` key
  - 400 for each of: `ftp://`, `javascript:alert(1)`, no scheme, `https://u:p@host`, a URL of 2,049 characters, an empty or whitespace-only name, a name of 101 characters, interval 29, interval 86401, interval 60.5, and an extra `userId`, `status` or `id`

---

## Phase 4: US2 – List & View (P1)

- [X] T008 [US2] `MonitorsService.findAll(userId)`: `findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, select: SELECT })`. `findOne(id, userId)`: returns `findOwned`.
- [X] T009 [US2] Controller: `@Get()` → `findAll`, and `@Get(':id')` → `findOne`
- [X] T010 [US2] E2E tests: a list with three monitors is newest first; a new user gets `[]`; get by id → 200; an unknown cuid and the malformed id `not-a-real-id` → 404

---

## Phase 5: US3 & US4 – Update, Pause/Resume (P2)

- [X] T011 [P] [US3] `UpdateMonitorDto implements UpdateMonitorRequest` in `monitors.dto.ts`: the same rules as create but every field `@IsOptional()`, plus `isActive`: `@IsOptional() @IsBoolean()`
- [X] T012 [US3] `MonitorsService.update(id, userId, dto)`:
  - if all four fields are `undefined`, throw `BadRequestException('At least one field must be provided')`
  - `const current = await findOwned(id, userId)`
  - `urlChanged = dto.url !== undefined && dto.url !== current.url`
  - `prisma.monitor.update({ where: { id }, data: { ...dto, ...(urlChanged && { status: 'PENDING', lastCheckedAt: null }) }, select: SELECT })`
  - catch `P2025` (concurrently deleted) → `NotFoundException('Monitor not found')`
- [X] T013 [US3] Controller: `@Patch(':id')` → `update`
- [X] T014 [US3] [US4] E2E tests:
  - updating the name only leaves the URL and interval unchanged
  - a URL change resets the status: first set `status: 'UP'` and `lastCheckedAt` directly via `PrismaService`, then PATCH the URL → `PENDING` / `null`
  - PATCH with the same URL and a new name keeps `UP`
  - invalid interval → 400 and the stored value is unchanged
  - `{}` → 400
  - pausing an `UP` monitor → `isActive: false` with status still `UP`; pausing again → 200 with no change; resuming → `isActive: true`

---

## Phase 6: US5 – Delete (P2)

- [X] T015 [US5] `MonitorsService.remove(id, userId)`: `const { count } = await prisma.monitor.deleteMany({ where: { id, userId } })`; if `count === 0`, throw `NotFoundException('Monitor not found')`
- [X] T016 [US5] Controller: `@Delete(':id') @HttpCode(204)` → `remove`
- [X] T017 [US5] E2E test:
  - create a monitor and insert 2 `Check` rows for it via `PrismaService`
  - DELETE → 204
  - `check.count({ where: { monitorId } })` is 0 and GET → 404
  - a second DELETE → 404

---

## Phase 7: US6 – Isolation (P1)

- [X] T018 [US6] E2E tests (SC-002): A creates monitor M. Then B:
  - lists and doesn't see M
  - GET, PATCH `{name}`, PATCH `{isActive:false}` and DELETE on M each → 404 with the message `Monitor not found`

  Finally A's GET shows M unchanged. Also: every monitors route without a token → 401. The existing guard-rail test in `auth.e2e-spec.ts` must pass with the 5 new routes and no allowlist change.

---

## Phase 8: Polish

- [X] T019 [P] Add the 5 monitors routes to the API table in `README.md`, and update the "Current state" line in `CLAUDE.md` and the `src/monitors/` entry under the `apps/api` section
- [X] T020 Run `npm run lint`, `npm run test` and `npm run test:e2e` (all with `-w @saas-pulse/api`), plus `npm run build`, and fix any failures
- [X] T021 Walk through `specs/003-monitors-crud/quickstart.md` against a running API

---

## Dependencies & Execution Order

- **Phase 2:** T001 ∥ (T002 → T003)
- **US1:** T004 ∥ T005, then T006 → T007
- **US2:** needs US1 (it creates monitors to list)
- **US3/US4:** need US2 (`findOwned`)
- **US5:** needs Foundational only
- **US6:** needs every route to exist
- **Polish:** last

## Implementation Strategy

US1 + US2 together are the usable MVP: add monitors and see them. US3–US5 finish management, and US6 proves isolation across every route. All stories are small, so they're built in one pass, with the full e2e suite run at the end.

## Implementation Notes

- **Editor type errors (outside this feature's scope, found during it):** VS Code bundles TypeScript 6.0, which no longer includes `@types/*` packages automatically. So `it`, `describe` and `expect` showed as "Cannot find name" in the editor, even though the CLI (TS 5.9) compiled fine. Fixed by adding `"types": ["node", "jest"]` to `apps/api/tsconfig.json`. Also removed `baseUrl`, which is deprecated and an error in TS 6; it was left over from the removed `paths` mapping. Both TS 5.9 and TS 6.0 now type-check `src` and `test` with no errors.
- **Test bug fixed:** the isolation test first built all four supertest requests up front. Supertest binds the server separately for each request, so they interfered with each other (`ECONNREFUSED`). The requests are now created inside the loop.
- **Jest can hang on a single e2e file:** running one e2e file on its own can leave Jest waiting on open Redis/Prisma handles. `--forceExit` avoids this; the full-suite run was unaffected.
