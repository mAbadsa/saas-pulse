---

description: "Task list for 004-ping-service"
---

# Tasks: Ping Service

**Input**: Design documents from `/specs/004-ping-service/`

**Tests**: Included. SC-003 and SC-004 require automated tests.

**Stories**:
- US1 Automatic checks
- US2 Up/down with reasons
- US3 SSRF protection

---

## Phase 1: Setup

- [X] T001 [P] Add `PING_ENABLED=true`, `PING_ALLOW_PRIVATE=false` and `PING_TIMEOUT_MS=10000` (under a `# Ping service` comment) to `.env.example`. To `apps/api/.env`, add `PING_ALLOW_PRIVATE=true` so local `localhost` monitors work in development.

---

## Phase 2: Foundational

- [X] T002 [P] Create `apps/api/src/ping/blocked-addresses.ts`: a `net.BlockList` with the IPv4 and IPv6 ranges from research §4, and `isBlockedAddress(ip: string): boolean`, which uses `net.isIP` to choose `'ipv4'` or `'ipv6'` and returns false for non-IPs
- [X] T003 [P] Create `apps/api/src/ping/ping.module.ts` (provides `PingService`) and add `PingModule` to the `imports` in `apps/api/src/app.module.ts`

---

## Phase 3: US3 – SSRF protection (P1)

(Built before the HTTP check, which depends on it.)

- [X] T004 [US3] Unit tests in `apps/api/src/ping/blocked-addresses.spec.ts`:
  - blocked: `127.0.0.1`, `10.1.2.3`, `172.16.0.1`, `192.168.1.1`, `169.254.169.254`, `100.64.0.1`, `0.0.0.0`, `224.0.0.1`, `::1`, `::`, `fd00::1`, `fe80::1`, `::ffff:127.0.0.1`, `::ffff:10.0.0.1`, `64:ff9b::a00:1`
  - allowed: `8.8.8.8`, `1.1.1.1`, `93.184.216.34`, `2606:4700:4700::1111`
  - `not-an-ip` → false
- [X] T005 [US3] In `apps/api/src/ping/http-check.ts`, implement `safeLookup`:
  - `dns.lookup(hostname, { ...options, all: true }, cb)`
  - on error, pass it through
  - if any address is blocked, return `new Error(\`Blocked address ${ip}\`)`
  - otherwise answer in the shape the caller asked for: `options.all` gives an array, otherwise `(null, address, family)` from the first result

---

## Phase 4: US2 – Outcomes (P1)

- [X] T006 [US2] In `apps/api/src/ping/http-check.ts`, implement `checkUrl(url, { timeoutMs, allowPrivate }): Promise<CheckResult>`. `CheckResult` is `{ isUp: boolean; statusCode: number | null; latencyMs: number | null; error: string | null }`.
  - parse with `new URL`; `host = hostname` with `[` `]` stripped
  - if `!allowPrivate && net.isIP(host) && isBlockedAddress(host)`, resolve down with `error: 'Blocked address <host>'` without connecting
  - `(protocol === 'https:' ? https : http).request(u, { method: 'GET', headers: { 'User-Agent': 'SaaSPulse/1.0 (+uptime monitor)' }, lookup: allowPrivate ? undefined : safeLookup })`
  - on `response`: `res.resume()`, latency `= Math.round(performance.now() - start)`, `isUp = status >= 200 && status < 400`
  - an overall `setTimeout(timeoutMs)` calls `req.destroy(new Error(\`Timed out after ${timeoutMs} ms\`))`; clear it when settled
  - on `error`: down, `error: err.message.slice(0, 500)`
  - never rejects
- [X] T007 [US2] In `apps/api/src/ping/ping.service.ts`, implement `recordResult(id, checkedUrl, result)` exactly as research §5: a transaction with `updateMany({ where: { id, url: checkedUrl }, data: { status: isUp ? 'UP' : 'DOWN', lastCheckedAt: now } })`, then create the `Check` only if `count === 1`

---

## Phase 5: US1 – Automatic, interval-aware checks (P1)

- [X] T008 [US1] `PingService.runCycle()`:
  - if `this.running`, return; otherwise set it and `try { ... } finally { this.running = false }`
  - select due monitors with the raw SQL from research §2 (`LIMIT 100`)
  - process them in chunks of 10 with `Promise.allSettled`, where each item is `checkUrl(...)` then `recordResult(...)`
  - log unexpected errors with Nest's `Logger`
  - add the comment `// ponytail: single-instance loop (in-memory overlap guard, 100/cycle); use a Redis lock or BullMQ for multiple instances or more volume`
- [X] T009 [US1] Lifecycle:
  - `onApplicationBootstrap`: if `config.get('PING_ENABLED') !== 'false'`, `this.timer = setInterval(() => void this.runCycle(), 10_000)`
  - `onModuleDestroy`: `clearInterval(this.timer)`
  - read `PING_ALLOW_PRIVATE === 'true'` and `PING_TIMEOUT_MS` (default 10000) in the constructor

---

## Phase 6: Tests (all stories)

- [X] T010 E2E tests in `apps/api/test/ping.e2e-spec.ts`:
  - **Setup:** set `process.env.PING_ENABLED='false'`, `PING_ALLOW_PRIVATE='true'` and `PING_TIMEOUT_MS='500'` **before** compiling `AppModule`; register a user; start a local `http.createServer` on `127.0.0.1:0` with routes `/ok` (200), `/redirect` (302), `/fail` (500) and `/hang` (never responds); get a closed port by listening and closing
  - Create monitors directly via `PrismaService` for the user, and call `app.get(PingService).runCycle()`
  - **US2:** `/ok` → UP with 200 and latency ≥ 0; `/redirect` → UP with 302; `/fail` → DOWN with 500; `/hang` → DOWN, error contains `Timed out`, statusCode null; closed port → DOWN, error contains `ECONNREFUSED`; each has exactly one Check row
  - **US1:**
    - a monitor checked 10 s ago with interval 300 isn't checked (check count unchanged)
    - setting `lastCheckedAt` 301 s ago → it is checked
    - a paused monitor is never checked
    - the URL-change race: call `recordResult(id, oldUrl, …)` after changing the URL → no Check row and the status is unchanged
    - a deleted monitor: `recordResult` doesn't throw
  - **US3 (SSRF)** in a separate `describe` that builds a second app with `PING_ALLOW_PRIVATE='false'`, or calls `checkUrl` directly with `allowPrivate: false`:
    - `http://127.0.0.1:<port>/ok` → down with `Blocked address 127.0.0.1`, and the local server's request counter stays 0
    - `http://localhost:<port>/ok` (resolves to a loopback address) → blocked, counter stays 0
    - `http://[::1]:<port>/` → blocked
    - `http://169.254.169.254/` → blocked with no network wait (latency null)
  - Clean up the users (cascade) and close the servers in `afterAll`

---

## Phase 7: Polish

- [X] T011 [P] Update `README.md` (env vars `PING_*`; status: monitors are now checked automatically) and `CLAUDE.md` (a `src/ping/` entry, the env block and the current state)
- [X] T012 Run `npm run lint`, `npm run test` and `npm run test:e2e` (all with `-w @saas-pulse/api`) plus `npm run build`, and fix any failures
- [X] T013 Run the quickstart against a fresh API instance with the loop enabled

## Dependencies

T002 → T004/T005 → T006 → T007 → T008 → T009 → T010 → T011–T013. T001 and T003 can run in parallel with T002.

## Implementation Notes

- **e2e suites now run serially** (`maxWorkers: 1` in `test/jest-e2e.json`). They share one database, and `runCycle()` checks every due monitor, including ones another suite is using at the same moment. One full-suite run failed once and couldn't be reproduced; this removes the likeliest cause. The ping test timeout was also raised from 500 ms to 2 s, because CPU contention during a cold ts-jest compile could push a local response past 500 ms. A full run takes about 11 s.
- **`test/setup-env.ts`** sets `PING_ENABLED=false` for every e2e suite, so the background loop never runs during tests.
- **Existing bug fixed:** `RedisModule` never closed its ioredis client, so `app.close()` (and Jest) never exited. It now calls `redis.quit()` in `onModuleDestroy`. The e2e suite exits cleanly without `--forceExit`.
- **Live quickstart result:** example.com → UP 200; a missing page → DOWN 404; `169.254.169.254` and `localhost` → DOWN "Blocked address …" with `PING_ALLOW_PRIVATE=false`.
