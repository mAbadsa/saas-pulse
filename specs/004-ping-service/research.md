# Research: Ping Service

## 1. Scheduler: `setInterval` vs `@nestjs/schedule`

- **Decision:** a plain `setInterval(10_000)`, started in `onApplicationBootstrap` if `PING_ENABLED !== 'false'` and cleared in `onModuleDestroy`.
- **Rationale:**
  - It's one timer with a fixed period. `@nestjs/schedule` would add a dependency and decorators, but the decorators can't easily be switched off by env var for tests.
  - Clearing the timer ourselves also guarantees Jest exits (no open handles).
- **Alternatives considered:** `@nestjs/schedule` (`@Interval`), which the roadmap names. It adds nothing here; revisit if cron-style schedules appear, for example weekly digests.

## 2. Selecting due monitors

- **Decision:** a Prisma `$queryRaw`:
  ```sql
  SELECT id, url FROM "Monitor"
  WHERE "isActive" AND ("lastCheckedAt" IS NULL
     OR "lastCheckedAt" + make_interval(secs => "intervalSeconds") <= now())
  ORDER BY "lastCheckedAt" ASC NULLS FIRST LIMIT 100
  ```
- **Rationale:**
  - The Prisma query builder can't compare one column plus another column's interval.
  - Doing it in SQL avoids loading every monitor into memory.
  - Ordering by `lastCheckedAt` means the most overdue monitors go first when more than 100 are due.

## 3. HTTP client and redirects

- **Decision:** `node:http` / `node:https` `request()`, GET only, with a `User-Agent: SaaSPulse/1.0` header. Redirects aren't followed, since those modules never follow them.
- **The response:** `res.resume()` discards the body, and latency is measured with `performance.now()` from the request start to the response headers.
- **Time limit:** an overall timer calls `req.destroy(new Error('Timed out after N ms'))`. Node's `timeout` option only covers socket idle time, so it isn't enough on its own.
- **Rationale:**
  - Global `fetch` can't take a custom DNS `lookup` without importing `undici` as a dependency, and the lookup hook is what makes SSRF protection correct (§4).
  - Not following redirects blocks the common SSRF bypass (a public URL redirecting to `http://169.254.169.254`), and it's how uptime checkers usually treat 3xx anyway (spec US2-5).

## 4. SSRF: validate at connect time

- **Decision:** two layers, both using the same `BlockList`:
  1. If `URL.hostname` (with IPv6 brackets stripped) is an IP literal (`net.isIP`), check it before any request. Node skips `lookup` for literals.
  2. Otherwise pass `lookup: safeLookup`. This calls `dns.lookup(host, { all: true })` and fails with `Blocked address <ip>` if **any** resolved address is blocked. It supports both callback shapes Node uses (`all: true` and single address).
- **Rationale:** checking at connect time means the address checked is the address connected to, which closes the DNS-rebinding gap that a separate pre-check would leave. Rejecting when *any* resolved address is blocked stops a mix of public and private records from getting through.
- **Blocked ranges** (a `net.BlockList`, which also matches IPv4-mapped IPv6 against the IPv4 rules; verified):
  - IPv4: 0.0.0.0/8, 10/8, 100.64/10, 127/8, 169.254/16, 172.16/12, 192.0.0/24, 192.0.2/24, 192.168/16, 198.18/15, 198.51.100/24, 203.0.113/24, 224/4, 240/4
  - IPv6: ::/128, ::1/128, fc00::/7, fe80::/10, ff00::/8, 64:ff9b::/96 (NAT64, which can embed private IPv4), 2001:db8::/32
- **Dev escape hatch:** `PING_ALLOW_PRIVATE=true` skips both layers, for local `localhost` monitors and for e2e tests against local servers.

## 5. Recording a result safely

- **Decision:**
  ```ts
  prisma.$transaction(async (tx) => {
    const { count } = await tx.monitor.updateMany({
      where: { id, url: checkedUrl },
      data: { status, lastCheckedAt: now },
    });
    if (count === 1) await tx.check.create({ data: { monitorId: id, ... } });
  });
  ```
- **Rationale:** one statement handles both "monitor deleted" and "URL changed since the check started" (FR-011): the update matches 0 rows, so the result is dropped with no exception to catch. The transaction keeps the monitor's status and its check history consistent.

## 6. Concurrency and overlap

- **Decision:**
  - a `running` boolean on the service, so a cycle that starts while the previous one is still running returns immediately
  - due monitors processed in chunks of 10 with `Promise.allSettled`
- **Rationale:** a single instance needs nothing more (`ponytail:` comment: use a Redis lock or BullMQ for multiple instances). Chunking caps sockets at 10, and `allSettled` means one failure never aborts the chunk.

## 7. Configuration

- **Decision:** `PING_ENABLED` (default on), `PING_ALLOW_PRIVATE` (default off), `PING_TIMEOUT_MS` (default 10000), all read with `ConfigService`. The interval (10 s), chunk size (10) and batch size (100) are constants.
- **Rationale:** tests need to switch off the timer, allow local targets and use short timeouts. The other values have no current reason to vary (Principle V).
