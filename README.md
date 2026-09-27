# SaaS Pulse

A real-time infrastructure monitoring platform. SaaS Pulse watches your servers, APIs and websites, and tracks their uptime, latency and response status.

> **Status:** early development. The monorepo, database schema and health endpoint are in place. Monitoring features are next; see the [roadmap](docs/ROADMAP.md).

## Tech Stack

| Layer | Tools |
|-------|-------|
| Frontend (`apps/web`) | React 19, Vite, Tailwind CSS v4, shadcn/ui |
| Backend (`apps/api`) | NestJS 11, TypeScript, Prisma 6 |
| Database & cache | PostgreSQL 15, Redis |
| Shared (`packages/shared`) | TypeScript types used by both apps |
| Tooling | npm workspaces, Docker Compose |

## Getting Started

### Prerequisites

- Node.js 20+ (developed on Node 24)
- Docker with Docker Compose

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Create the API env file.
#    In DATABASE_URL, replace user:password with the credentials from docker-compose.yml.
#    Set JWT_SECRET to a random value: openssl rand -hex 32
cp .env.example apps/api/.env

# 3. Start PostgreSQL (port 5442) and Redis (port 6389)
npm run db:up

# 4. Apply database migrations and generate the Prisma client
npm run prisma:migrate
npm run prisma:generate

# 5. Run the API and the web app (in two terminals)
npm run dev:api   # http://localhost:3000
npm run dev:web   # http://localhost:5173
```

Open http://localhost:5173. The page should show the API health status, with both `database` and `redis` reported as `ok`.

## Scripts

Run these from the repo root:

| Command | Description |
|---------|-------------|
| `npm run dev:api` | Build shared types, then start the API in watch mode |
| `npm run dev:web` | Start the Vite dev server |
| `npm run build` | Build shared → api → web |
| `npm run build:shared` | Rebuild shared types (needed after editing them while the API runs) |
| `npm run db:up` / `db:down` | Start / stop PostgreSQL and Redis |
| `npm run prisma:migrate` | Create and apply migrations (`prisma migrate dev`) |
| `npm run prisma:generate` | Regenerate the Prisma client |

Per-app scripts:
- **API:** `npm run test -w @saas-pulse/api`. Also available: `test:e2e`, `lint`, `format`.
- **Web:** `npm run lint -w @saas-pulse/web`.

## Environment Variables

| Variable | Used by | Default |
|----------|---------|---------|
| `DATABASE_URL` | API | (required) |
| `REDIS_HOST` / `REDIS_PORT` | API | `localhost` / `6389` |
| `PORT` | API | `3000` |
| `CORS_ORIGIN` | API | `http://localhost:5173` |
| `JWT_SECRET` | API | (required; generate with `openssl rand -hex 32`) |
| `JWT_EXPIRES_IN` | API | `1d` |
| `VITE_API_URL` | Web | `http://localhost:3000` |

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | API name |
| GET | `/health` | Database and Redis status: `{ status, timestamp, services }` |
| POST | `/auth/register` | Create an account: `{ email, password, name? }` → `{ accessToken, user }` |
| POST | `/auth/login` | Sign in: `{ email, password }` → `{ accessToken, user }` |
| GET | `/auth/me` | The signed-in user's profile (requires a token) |

Every endpoint except `/`, `/health`, `/auth/register` and `/auth/login` requires `Authorization: Bearer <accessToken>`.

## Project Structure

```text
saas-pulse/
├── apps/
│   ├── api/              # NestJS API (Prisma schema in prisma/)
│   └── web/              # React + Vite frontend
├── packages/
│   └── shared/           # Shared TypeScript types
├── docs/ROADMAP.md       # Feature roadmap
├── specs/                # Feature specs (Spec Kit)
├── infrastructure/       # Docker / Terraform (planned)
└── docker-compose.yml    # Local PostgreSQL + Redis
```

## Data Model

- **User:** owns monitors.
- **Monitor:** a URL to check.
  - Fields: name, URL, check interval, active/paused flag, current status (`PENDING`, `UP` or `DOWN`).
- **Check:** the result of one ping.
  - Fields: up/down, HTTP status code, latency in ms, error message.

## Roadmap

1. **MVP:** JWT auth, monitor CRUD, a cron-based ping service, check history in PostgreSQL, and a status cache in Redis.
2. **Dashboard:** live status cards, uptime and latency stats, Socket.io updates, Recharts charts.
3. **Alerts:** Telegram, Slack/Discord and email.
4. **SaaS features:** public status pages, multi-region checks, AI incident analysis.
5. **DevOps:** GitHub Actions CI/CD, Prometheus and Grafana.

The full details are in [docs/ROADMAP.md](docs/ROADMAP.md).
