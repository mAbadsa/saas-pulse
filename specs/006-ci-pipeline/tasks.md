---

description: "Task list for 006-ci-pipeline"
---

# Tasks: Continuous Integration Pipeline

**Input**: `/specs/006-ci-pipeline/`

**Stories**:
- US1 Automatic checks
- US2 Fresh-checkout fidelity

## Phase 1: US1 + US2 – Workflow (P1)

- [ ] T001 [US1] [US2] Create `.github/workflows/ci.yml`:
  - `on: push` (all branches) and `pull_request`
  - `concurrency: { group: ci-${{ github.ref }}, cancel-in-progress: true }`
  - one `check` job: `runs-on: ubuntu-latest`, `timeout-minutes: 15`
  - services with health checks:
    - `postgres:15-alpine` (user, password and db `ci`/`ci`/`saas_pulse`; port 5432)
    - `redis:alpine` (port 6379)
  - job env: `DATABASE_URL`, `REDIS_HOST=localhost`, `REDIS_PORT=6379`
  - steps:
    1. checkout
    2. `setup-node` (Node 24, `cache: npm`)
    3. `npm ci`
    4. generate `JWT_SECRET` into `$GITHUB_ENV`
    5. `npm run build:shared`
    6. `npm run prisma:generate`
    7. `npx -w @saas-pulse/api prisma migrate deploy`
    8. lint the API
    9. lint the web app
    10. `git diff --exit-code` (formatting drift)
    11. `npm run test -w @saas-pulse/api`
    12. `npm run test:e2e -w @saas-pulse/api`
    13. `npm run build`
- [ ] T002 [US2] Validate the workflow YAML, then run it locally with `act` (or, failing that, replay the same commands against a fresh throwaway database) and confirm every step passes

## Phase 2: Polish

- [ ] T003 [P] `CLAUDE.md`:
  - GitHub Actions is no longer *(planned)*; add a CI line
  - rewrite the Roadmap section to reflect what's built: the ping service uses `setInterval` rather than `@nestjs/schedule`, the Redis cache is deferred, and phase 1 is done
- [ ] T004 [P] `README.md`: add a CI status badge and a short "CI" note (what runs on every push)
- [ ] T005 Commit, push, and confirm the first GitHub Actions run passes. Also confirm a failing step fails the run (SC-002: already covered if `act` shows a lint failure fails the job, otherwise a throwaway local test)

## Dependencies

T001 → T002 → T005; T003 and T004 can run in parallel.
