# Implementation Plan: Continuous Integration Pipeline

**Branch**: `006-ci-pipeline` | **Date**: 2026-09-28 | **Spec**: [spec.md](./spec.md)

## Summary

One GitHub Actions workflow, `.github/workflows/ci.yml`, with a single job on `ubuntu-latest`, triggered by `push` (all branches) and `pull_request`. The job:

- **Services:** starts `postgres:15-alpine` and `redis:alpine` as service containers with health checks.
- **Setup:** Node 24 with the npm cache, then `npm ci`.
- **Environment:** a `JWT_SECRET` from `openssl rand -hex 32` is written to `$GITHUB_ENV` for this run only. `DATABASE_URL` and `REDIS_*` point at the services.
- **Steps:**
  1. build the shared package
  2. `prisma generate` and `prisma migrate deploy`
  3. lint the API and web app, then `git diff --exit-code` to catch formatting drift, because the API's lint script runs `eslint --fix`
  4. API unit tests, then API e2e tests
  5. `npm run build`
- **Limits:** `concurrency` with `cancel-in-progress`, and `timeout-minutes: 15`.

## Technical Context

- **Platform**: GitHub Actions, `ubuntu-latest`, Node 24 (the same major version as local development)
- **Services**: PostgreSQL 15 (matching `docker-compose.yml`) and Redis. The CI services use their standard ports inside the runner, so the remapped local ports (5442/6389) aren't needed there.
- **New dependencies**: none (only official `actions/checkout` and `actions/setup-node`)
- **Testing the pipeline**: run it locally with `act` before pushing, then check the first real run on GitHub.

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I–IV | ✅ | No application code or schema changes. The schema comes from the committed migrations (`migrate deploy`). |
| V. Simplicity | ✅ | One job, no matrix, no caching beyond `setup-node`'s npm cache, and no deploy steps. |
| VI. Auth & Isolation | ✅ | The e2e suite, including the guard-rail and two-user isolation tests, now runs on every change. |
| Tech constraints (secrets) | ✅ | `JWT_SECRET` is generated per run and never committed. The Postgres credentials are throwaway values for the service container. |
| Dev workflow | ✅ | Automates the gates the constitution already requires (lint, test, test:e2e, build). |

## Project Structure

```text
.github/workflows/ci.yml   # new
CLAUDE.md                  # Tech stack: GitHub Actions is no longer "planned"; roadmap section brought up to date
README.md                  # CI badge / note
```

## Complexity Tracking

No violations.
