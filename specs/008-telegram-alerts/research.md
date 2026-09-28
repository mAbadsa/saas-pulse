# Research: Telegram Alerts

## 1. Receiving `/start`: long polling vs webhook

- **Decision:** long polling with `getUpdates?timeout=25&offset=<last+1>`, in a loop inside `TelegramPoller`. It starts on bootstrap when `TELEGRAM_BOT_TOKEN` is set and `PING_ENABLED !== 'false'` (the same background-work gate the e2e tests switch off), and is stopped by aborting the in-flight request on shutdown. On an error it waits 5 s and retries.
- **Rationale:** it works on localhost and behind NAT with no public HTTPS endpoint, which a webhook requires. There's also no inbound route to secure.
- **Upgrade path** (`ponytail:`): with multiple API instances, only one can poll a given bot, so switch to `setWebhook` plus a route with a secret token.

## 2. Linking accounts with deep-link codes

- **Decision:**
  - `crypto.randomBytes(18).toString('base64url')` gives 24 characters from `[A-Za-z0-9_-]`, within Telegram's limits for the start parameter (64 characters, the same alphabet).
  - Codes are stored in a `Map<code, { userId, expiresAt }>` with a 10-minute lifetime. They're single-use (deleted on redeem), and expired entries are swept on each `issue()`.
  - The link is `https://t.me/<username>?start=<code>`. The bot's username comes from `getMe`, cached after the first successful call.
- **Rationale:** the user types nothing (SC-001), and a code can't be guessed (144 bits).
- **Ceiling** (`ponytail:`): codes live in memory, so a restart invalidates pending links and multiple instances wouldn't share them. The upgrade is to store them in Redis with a TTL.

## 3. Incident state machine

Stored in `Monitor.alertDownSince` (null means no outstanding alert).

After each saved check, `onCheckRecorded(monitorId, isUp)` does one of two things:

- **Down path** (`!isUp`):
  1. Read the last 2 checks for the monitor.
  2. If both are down, run `updateMany({ where: { id, alertDownSince: null }, data: { alertDownSince: <older check's checkedAt> } })`.
  3. If `count === 1`, send the down message.
- **Up path:**
  1. Read `alertDownSince`.
  2. If it's set, run `updateMany({ where: { id, alertDownSince: <that value> }, data: { alertDownSince: null } })`.
  3. If `count === 1`, send the recovered message with `now - alertDownSince`.

**Why guarded updates:** the conditional write is the dedupe. A second concurrent evaluator matches 0 rows, so it sends nothing (SC-003).

**Why state is tracked even without a channel:** delivery just looks up the channel, so the state machine behaves the same whether or not anything gets sent.

**Why not send inline:** the state write is awaited, but the Telegram send is fire-and-forget (`void this.deliver(...)`, which logs its own errors). A slow or unreachable Telegram can't delay the ping cycle (SC-004).

**URL change:** `MonitorsService.update` adds `alertDownSince: null` alongside the existing `status: PENDING` reset (FR-006).

## 4. Messages

- **Format:** plain text with no `parse_mode`, so monitor names can't inject Markdown or HTML.
  ```
  🔴 DOWN: Marketing site
  https://example.com
  Reason: HTTP 503        (or the error text, e.g. "Timed out after 10000 ms")
  Failing since 14:03 UTC
  ```
  ```
  🟢 RECOVERED: Marketing site
  https://example.com
  Down for 12m 30s
  ```
- **Down reason:** the latest failing check's `statusCode` (as "HTTP n") or its `error`.
- **Duration:** `formatDuration(ms)` gives `45s`, `12m 30s`, `3h 5m` or `2d 4h`.

## 5. Client and timeouts

- **Decision:** `fetch(`${TELEGRAM_API_URL}/bot${token}/<method>`, { signal: AbortSignal.timeout(5000) })` for `sendMessage` and `getMe`. `getUpdates` uses its own abort controller with a 30 s timeout for long polling.
- **Errors:** a non-`ok` response throws `TelegramError(description)`. The test endpoint turns it into a `502` carrying Telegram's description, for example "Forbidden: bot was blocked by the user".
- **Configuration:** `TELEGRAM_API_URL` defaults to `https://api.telegram.org` and is overridden only in tests.
- **Security note:** the token is part of the request URL, so request URLs must never be logged. The logger only logs error descriptions.

## 6. Web connect flow

- **Flow:**
  1. The user clicks "Connect Telegram", which calls `POST /alerts/telegram/link`.
  2. The page shows an "Open Telegram" link (`target="_blank"`) and the steps: "press Start".
  3. The page polls `GET /alerts/telegram` every 3 s until `connected` is true or the link expires (10 minutes), then shows "Connected ✓".
- **Rationale:** the page updates without a reload (US1-2), and polling stops once connected or expired.
