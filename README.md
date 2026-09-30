# SaaS Pulse

[![CI](https://github.com/mAbadsa/saas-pulse/actions/workflows/ci.yml/badge.svg)](https://github.com/mAbadsa/saas-pulse/actions/workflows/ci.yml)

A real-time infrastructure monitoring platform. SaaS Pulse watches your servers, APIs and websites, and tracks their uptime, latency and response status.

> **Status:** early development. The API (auth, monitors, automatic checks, uptime/latency stats) and a web app with live status, 24 h stats, per-monitor latency charts and Telegram alerts are in place — see the [roadmap](docs/ROADMAP.md).

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

Open http://localhost:5173, create an account and add a monitor. It shows **Pending**, then **Up** or **Down** after the first check (about 15 s). To check the API itself, `curl localhost:3000/health`.

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

## Alerts (Telegram)

When a monitor fails **2 checks in a row**, SaaS Pulse sends one 🔴 DOWN message. On the next successful check it sends one 🟢 RECOVERED message with the downtime. There are no repeats while a monitor stays down, and single-check blips don't alert.

**To enable (once per server):**
1. Message [@BotFather](https://t.me/BotFather) in Telegram, send `/newbot`, and copy the token into `apps/api/.env` as `TELEGRAM_BOT_TOKEN=...`.
2. Restart the API. Users can then open **Settings → Connect Telegram** in the web app and press **Start** in the bot.

## CI

Every push and pull request runs [`.github/workflows/ci.yml`](.github/workflows/ci.yml):
- lint for the API and web app (it also fails if lint would reformat any file)
- API unit tests
- API e2e tests against real PostgreSQL 15 and Redis services
- the full build

The JWT secret is generated per run; nothing secret is committed.

## Environment Variables

| Variable | Used by | Default |
|----------|---------|---------|
| `DATABASE_URL` | API | (required) |
| `REDIS_HOST` / `REDIS_PORT` | API | `localhost` / `6389` |
| `PORT` | API | `3000` |
| `CORS_ORIGIN` | API | `http://localhost:5173` |
| `JWT_SECRET` | API | (required; generate with `openssl rand -hex 32`) |
| `JWT_EXPIRES_IN` | API | `1d` |
| `PING_ENABLED` | API | `true` (set `false` to stop the background checker) |
| `PING_ALLOW_PRIVATE` | API | `false`; **local dev only**: lets monitors reach `localhost`/private IPs |
| `PING_TIMEOUT_MS` | API | `10000` |
| `CHECK_RETENTION_DAYS` | API | `30` (minimum 7); older checks are deleted hourly |
| `TELEGRAM_BOT_TOKEN` | API | unset (Telegram alerts off). A bot token from @BotFather; **secret**, keep it in `apps/api/.env` only |
| `VITE_API_URL` | Web | `http://localhost:3000` |

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | API name |
| GET | `/health` | Database and Redis status: `{ status, timestamp, services }` |
| POST | `/auth/register` | Create an account: `{ email, password, name? }` → `{ accessToken, user }` |
| POST | `/auth/login` | Sign in: `{ email, password }` → `{ accessToken, user }` |
| GET | `/auth/me` | The signed-in user's profile (requires a token) |
| POST | `/monitors` | Create a monitor: `{ name, url, intervalSeconds? }` (interval 30–86400 s, default 60) |
| GET | `/monitors` | List your monitors, newest first |
| GET | `/monitors/:id` | Get one of your monitors |
| PATCH | `/monitors/:id` | Update `name`, `url`, `intervalSeconds`, or `isActive` (pause/resume) |
| GET | `/monitors/stats` | 24 h uptime % and average latency for each of your monitors |
| GET | `/monitors/:id/stats?range=24h\|7d` | Period uptime/latency, a time series (1 h / 6 h slots) and the 20 most recent checks |
| DELETE | `/monitors/:id` | Delete a monitor and its check history |
| GET | `/alerts/telegram` | Telegram alert status: `{ available, connected, enabled, connectedAt }` |
| POST | `/alerts/telegram/link` | One-time link (10 min) that opens the bot; pressing Start connects the chat |
| PATCH | `/alerts/telegram` | `{ enabled }`: turn alerts on or off |
| DELETE | `/alerts/telegram` | Disconnect Telegram |
| POST | `/alerts/telegram/test` | Send a test message |

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
