# 🚀 CLAUDE.md - SaaS Pulse Guide

## 📌 Project Overview

**SaaS Pulse** is a full-stack, real-time infrastructure monitoring platform (SaaS). It monitors servers, APIs and websites for uptime, latency and response status. It is built as a monorepo with a modern DevOps setup.

**Current state:** early stage.
- The API has only `/` and `/health`.
- The web app shows the health response and is being restyled with Tailwind and shadcn.

---

## 🛠️ Tech Stack & Architecture

Items marked *(planned)* are part of the target stack but are not installed yet. Add them when the feature that needs them is built.

- **Architecture:** monorepo using npm workspaces (`package-lock.json`, so use npm, not pnpm)
- **Frontend (`apps/web`):** React 19, Vite, Tailwind CSS v4, shadcn/ui (Base UI, lucide-react), Recharts *(planned)*
- **Backend (`apps/api`):** NestJS 11, TypeScript, Prisma 6 ORM, ioredis, `@nestjs/schedule` for cron jobs *(planned)*, Socket.io *(planned)*
- **Database & cache:** PostgreSQL 15, Redis
- **Shared (`packages/shared`):** shared TypeScript types, interfaces and validation schemas
- **DevOps & infra:**
  - Docker & Docker Compose (local Postgres + Redis)
  - Nginx *(planned)*
  - GitHub Actions CI/CD *(planned: `.github/workflows/` is empty)*

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
│   └── workflows/          # CI/CD pipelines (empty)
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
- `prisma/schema.prisma` + `prisma/migrations/`

### `apps/web` (`@saas-pulse/web`)

- Vite dev server on port 5173.
- The API URL comes from `VITE_API_URL` (default `http://localhost:3000`).
- `@/*` → `src/*`.
- shadcn components live in `src/components/ui`, helpers in `src/lib`, and config in `components.json`.
- Use the `styling` skill when adding or changing UI.

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

The full plan is in `docs/ROADMAP.md`. Build in this order. Nothing below is implemented yet.

1. **Core (MVP)**
   - **Monitors CRUD:** name, URL and ping interval. Monitors can be paused and resumed. Deleting a monitor also deletes its logs.
   - **Ping service:** a `@nestjs/schedule` cron job (for example, every minute) that:
     - sends an HTTP GET to each active monitor,
     - records the status code and latency in ms,
     - catches timeouts and network failures and logs the exact error.
   - **Logging & caching:**
     - Every check is saved to Postgres through Prisma.
     - The current status of each monitor is cached in Redis, and dashboard reads come from Redis, not the DB.
   - **Auth:** JWT for register, login and route protection. Multi-tenant: every query is scoped to the current user's own data.
2. **Dashboard (web)**
   - Status cards with badges: UP (green), DOWN (red), PENDING (gray).
   - Average latency and uptime %.
   - Live updates over Socket.io, with no page refresh.
   - Recharts latency charts for the last 24 hours and 7 days.
3. **Alerts:** Telegram bot, Slack/Discord webhooks, and email. Alerts fire when a monitor goes down or recovers; email also sends a weekly digest.
4. **SaaS extras:**
   - Public status pages (for example, `status.pulse.com/<company>`).
   - Multi-region checks (for example, EU and US-East) to avoid false positives.
   - AI analysis of recurring downtime patterns.
5. **DevOps:**
   - GitHub Actions: test, lint, Docker image build and deploy check on every push.
   - Prometheus + Grafana for the app's own metrics.

---

## 📐 Conventions

- NestJS: one module per feature, with a controller and a service. Use global modules for infrastructure (Prisma, Redis).
- API code uses single quotes and Prettier. Import shared types with `import type`.
- New features follow the Spec Kit flow (`speckit-specify` → `plan` → `tasks` → `implement`), with the files under `specs/NNN-feature-name/`.
