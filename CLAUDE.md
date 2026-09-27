# CLAUDE.md

## Project

**SaaS Pulse**: a server-monitoring SaaS, still at an early stage. Users register servers, the app tracks each server's status (`ONLINE`/`OFFLINE`/`DEGRADED`/`UNKNOWN`), and servers send in logs. Right now the API has only a root endpoint and a `/health` endpoint, and the web app only shows the health response.

## Layout

npm workspaces monorepo:

- `apps/api` (`@saas-pulse/api`): NestJS 11 API. It uses Prisma 6 with PostgreSQL and ioredis for Redis.
  - `src/main.ts`: bootstrap. Configures CORS from `CORS_ORIGIN` (default `http://localhost:5173`) and the port from `PORT` (default 3000).
  - `src/app.module.ts`: `ConfigModule` (global). It loads `.env` and then `../../.env`.
  - `src/prisma/`: global `PrismaService`, which extends `PrismaClient`.
  - `src/redis/`: global ioredis client, injected with `@Inject(REDIS_CLIENT)`. Configured with `REDIS_HOST`/`REDIS_PORT`.
  - `src/app.service.ts`: `/health` pings the DB (`SELECT 1`) and Redis.
  - `prisma/schema.prisma` + `prisma/migrations/`
- `apps/web` (`@saas-pulse/web`): React 19 + Vite, on port 5173. Reads the API URL from `VITE_API_URL` (default `http://localhost:3000`).
- `packages/shared` (`@saas-pulse/shared`): TypeScript types shared by the API and the web app, such as `HealthCheckResponse` and `ApiErrorResponse`. Put request/response contracts here.
  - Web resolves it through a Vite alias to `src/index.ts`.
  - API resolves it as a normal package (`packages/shared/dist/`). `dev:api` builds shared first; after changing the types while the API is running, run `npm run build:shared`.
- `infrastructure/` (docker, terraform): empty placeholders.

## Commands (run from repo root)

```bash
npm install
npm run db:up             # start Postgres 15 + Redis in Docker (docker-compose.yml)
npm run db:down
npm run prisma:generate
npm run prisma:migrate    # prisma migrate dev
npm run dev:api           # nest start --watch
npm run dev:web           # vite
npm run build             # shared -> api -> web
npm run build:shared
```

API only (`-w @saas-pulse/api`): `test` (Jest unit tests, `*.spec.ts` in `src/`), `test:e2e`, `lint`, `format`.
Web only (`-w @saas-pulse/web`): `lint`, `preview`.

## Environment

The API reads `apps/api/.env` (or a root `.env`):

```
DATABASE_URL=postgresql://muhammad:123456@localhost:5442/saas_pulse
REDIS_HOST=localhost
REDIS_PORT=6389
```

These DB credentials come from `docker-compose.yml` and are for local development only.

## Data model: current state (watch out)

- The first migration created `User`, `Server` (belongs to a User) and `Log` (belongs to a Server, `metadata` JSONB). These tables use cascade deletes.
- The second migration (`create_initial_schema`) **drops** all three tables.
- In `schema.prisma`, the models are commented out after a failed `prisma db pull`. Only the `ServerStatus` and `LogLevel` enums remain.
- Before adding features that use these tables, restore the models in `schema.prisma` and create a new migration.

## Conventions

- NestJS style: one module per feature, with a controller and a service. Use global modules for infrastructure (Prisma, Redis).
- API code uses single quotes and Prettier. Import shared types with `import type`.
