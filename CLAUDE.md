# 🚀 CLAUDE.md - SaaS Pulse Guide

## 📌 Project Overview

**SaaS Pulse** is a full-stack, real-time infrastructure monitoring platform (SaaS). It monitors servers, APIs and websites for uptime, latency and response status. It is built as a monorepo with a modern DevOps setup.

**Current state:** early stage.
- The API has `/`, `/health`, JWT auth (`/auth/*`) and monitors CRUD (`/monitors`), and a ping service that checks active monitors automatically. The web dashboard is next.
- The web app has sign-in/register and a monitors page (list with live status, add/edit, pause/resume, delete).

---

## 🛠️ Tech Stack & Architecture

Items marked *(planned)* are part of the target stack but are not installed yet. Add them when the feature that needs them is built.

- **Architecture:** monorepo using npm workspaces (`package-lock.json`, so use npm, not pnpm)
- **Frontend (`apps/web`):** React 19, Vite, Tailwind CSS v4, shadcn/ui (Base UI, lucide-react), Recharts *(planned)*
- **Backend (`apps/api`):** NestJS 11, TypeScript, Prisma 6 ORM, ioredis, Socket.io *(planned)*. The ping loop is a plain `setInterval`, not `@nestjs/schedule`.
- **Database & cache:** PostgreSQL 15, Redis
- **Shared (`packages/shared`):** shared TypeScript types, interfaces and validation schemas
- **DevOps & infra:**
  - Docker & Docker Compose (local Postgres + Redis)
  - Nginx *(planned)*
  - GitHub Actions CI: `.github/workflows/ci.yml` runs lint, the formatting-drift check, unit and e2e tests (Postgres + Redis services) and the build on every push and PR. Deploy is *(planned)*.

---

## 📁 Repository Structure

```text
saas-pulse/
├── apps/
│   ├── web/                # React Vite frontend
│   └── api/                # NestJS backend API
├── packages/
│   └── shared/             # Shared TS types & constants
├── infrastructure/
│   ├── docker/             # Custom Dockerfiles & Nginx configs (empty)
│   └── terrfaform/         # Infrastructure as Code, optional (empty; folder name is misspelled)
├── .github/
│   └── workflows/ci.yml    # CI: lint, tests, e2e, build
├── specs/                  # Spec Kit feature specs (spec/plan/tasks per feature)
├── .specify/               # Spec Kit config, templates & scripts
├── docker-compose.yml      # Local dev services (PostgreSQL & Redis)
└── CLAUDE.md
```

### `apps/api` (`@saas-pulse/api`)

- `src/main.ts`: bootstrap. CORS origin comes from `CORS_ORIGIN` (default `http://localhost:5173`) and the port from `PORT` (default 3000).
- `src/app.module.ts`: global `ConfigModule`. It loads `.env`, then `../../.env`.
- `src/prisma/`: global `PrismaService`, which extends `PrismaClient`.
- `src/redis/`: global ioredis client, injected with `@Inject(REDIS_CLIENT)`.
- `src/app.service.ts`: `/health` pings the DB (`SELECT 1`) and Redis.
- `src/auth/`: register/login/me, the global `AuthGuard`, `@Public()` and `@CurrentUser()`.
- `src/monitors/`: monitors CRUD. Every query is scoped by `userId`, pause/resume uses `PATCH { isActive }`, and changing the URL resets `status` to `PENDING`.
- `src/ping/`: background checker. A `setInterval` loop (every 10 s) finds due monitors with raw SQL, sends one GET each (no redirects, body discarded) and saves a `Check`. An SSRF guard blocks non-public IPs at connect time (`safeLookup` + `blocked-addresses.ts`). e2e tests set `PING_ENABLED=false` and call `runCycle()` directly; the e2e suites run serially because they share the DB.
- `test/`: e2e tests (`*.e2e-spec.ts`), run against the local Docker DB.
- `prisma/schema.prisma` + `prisma/migrations/`

### `apps/web` (`@saas-pulse/web`)

- Vite dev server on port 5173.
- The API URL comes from `VITE_API_URL` (default `http://localhost:3000`).
- `@/*` → `src/*`.
- shadcn components live in `src/components/ui`, helpers in `src/lib`, and config in `components.json`.
- Use the `styling` skill when adding or changing UI.
- Routes (`react-router`): `/login`, `/register` (public-only) and `/` (monitors, needs sign-in). They're set up in `App.tsx`, with `BrowserRouter` + `AuthProvider` in `main.tsx`.
- `lib/api.ts`: `api<T>(path, { method, body })` adds the Bearer token and throws `ApiError { status, messages }`. A 401 on a non-`/auth/*` call signs out with the "session expired" message.
- `auth/`: `AuthProvider` + `useAuth()` (in `auth-context.ts`, a separate file for react-refresh). The session lives in `localStorage` (`lib/session.ts`); **moving it to httpOnly cookies is a follow-up before any public deployment.**
- `monitors/`: `MonitorsPage` polls `GET /monitors` every 15 s while the tab is visible. The row layout is responsive (cards on mobile), and `StatusBadge` always shows an icon and text. Only set state in promise callbacks when code runs from an effect (the `react-hooks/set-state-in-effect` lint rule).
- There's no web test runner yet. The gates are `npm run lint -w @saas-pulse/web` and `npm run build`.

### `packages/shared` (`@saas-pulse/shared`)

- Put request/response contracts here.
- The web app resolves the package through a Vite alias to `src/index.ts`.
- The API resolves it as a normal package, from `dist/`:
  - `dev:api` builds shared before starting.
  - If you change the types while the API is running, run `npm run build:shared`.

---

## ⌨️ Commands (from repo root)

```bash
npm install
npm run db:up             # start Postgres + Redis (docker-compose.yml)
npm run db:down
npm run prisma:generate
npm run prisma:migrate    # prisma migrate dev
npm run dev:api           # build shared, then nest start --watch
npm run dev:web           # vite
npm run build             # shared -> api -> web
npm run build:shared
```

- **API only** (`-w @saas-pulse/api`): `test` (Jest, `*.spec.ts` in `src/`), `test:e2e`, `lint`, `format`.
- **Web only** (`-w @saas-pulse/web`): `lint`, `preview`.

---

## 🔐 Environment

Copy `.env.example` to `.env`. The API reads `apps/api/.env` or the root `.env`. Local Docker ports are remapped:

```
DATABASE_URL=postgresql://muhammad:123456@localhost:5442/saas_pulse
REDIS_HOST=localhost
REDIS_PORT=6389
JWT_SECRET=<openssl rand -hex 32>   # required; the API refuses to start without it
JWT_EXPIRES_IN=1d
PING_ALLOW_PRIVATE=true   # local dev only: lets monitors reach localhost
```

These credentials come from `docker-compose.yml` and are for local development only.

---

## 🗄️ Data Model (`apps/api/prisma/schema.prisma`)

- **`User`:** email (unique), name, password hash.
- **`Monitor`:** one URL being watched.
  - Belongs to a User.
  - Fields: `name`, `url`, `intervalSeconds` (default 60), `isActive` (the pause/resume flag), `status`, `lastCheckedAt`.
- **`Check`:** the result of one ping.
  - Belongs to a Monitor.
  - Fields: `isUp`, `statusCode`, `latencyMs`, `error`, `checkedAt`.
  - `statusCode` and `latencyMs` are null when the request failed. `error` holds the timeout, DNS or connection message.
  - Indexed on `(monitorId, checkedAt)` for the charts and uptime %.
- **`MonitorStatus`:** `PENDING` | `UP` | `DOWN`. A paused monitor keeps its last status; pausing is `isActive = false`, not a status.
- **Cascade deletes:** deleting a User removes its Monitors, and deleting a Monitor removes its Checks.
- Every query must be scoped to the current user (`userId`). The app is multi-tenant.

---

## 🗺️ Roadmap

The full plan is in `docs/ROADMAP.md`. Each built feature has its spec in `specs/NNN-*/`.

**Done:**
- **Phase 1 (MVP):**
  - JWT auth (`002`)
  - monitors CRUD (`003`)
  - ping service (`004`): a `setInterval` loop plus an SSRF guard; Postgres holds the check history and current status
  - web sign-in and monitors UI (`005`)
- **CI** (`006`), part of phase 5

**Deferred:**
- **Redis status cache:** the monitor row already holds the current status. Add the cache when something needs fast reads, such as live dashboard updates.

**Next, in order:**
1. **Dashboard (phase 2):**
   - uptime % and average latency (24 h / 7 d)
   - a monitor detail page with a Recharts latency chart
   - a check-history retention policy
   - later, Socket.io live updates in place of the 15 s polling
2. **Security before public deployment:**
   - rate limiting on login and register
   - moving the session from `localStorage` to httpOnly cookies
3. **Alerts (phase 3):** Telegram, Slack/Discord webhooks and email, firing when a monitor goes down or recovers, plus a weekly digest.
4. **SaaS extras (phase 4):**
   - public status pages
   - multi-region checks
   - AI analysis of downtime patterns
5. **DevOps (the rest of phase 5):**
   - Docker images and deploy
   - Prometheus + Grafana

---

## 📐 Conventions

- NestJS: one module per feature, with a controller and a service. Use global modules for infrastructure (Prisma, Redis).
- API code uses single quotes and Prettier. Import shared types with `import type`.
- New features follow the Spec Kit flow (`speckit-specify` → `plan` → `tasks` → `implement`), with the files under `specs/NNN-feature-name/`.

### Auth & data isolation

- Every route requires a valid Bearer token unless it is marked `@Public()`. The global `AuthGuard` enforces this, and an e2e test fails if a non-allowlisted route is reachable without a token.
- Get the caller with `@CurrentUser() user: UserProfile`. Never parse the token yourself.
- Every query on owned data filters by the caller's id:
  - `where: { id, userId: user.id }` for a Monitor
  - `where: { monitor: { userId: user.id } }` for a Check
- A record owned by someone else returns **404**, the same as a missing one, never 403.
- `userId` always comes from `@CurrentUser()`, never from the request body. The global `ValidationPipe` rejects unknown body fields.
