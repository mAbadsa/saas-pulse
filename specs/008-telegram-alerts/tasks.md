---

description: "Task list for 008-telegram-alerts"
---

# Tasks: Telegram Alerts

**Input**: `/specs/008-telegram-alerts/`

**Stories**:
- US1 Connect Telegram
- US2 Down/recovered alerts
- US3 Controls

## Phase 1: Setup

- [X] T001 Schema change from data-model.md (`AlertChannelType`, `AlertChannel`, `User.alertChannels`, `Monitor.alertDownSince`), then `npx prisma migrate dev --name telegram_alerts` in `apps/api`
- [X] T002 [P] Add `TELEGRAM_BOT_TOKEN=` (empty) and a comment about BotFather to `.env.example`
- [X] T003 [P] Add `TelegramStatus`, `TelegramLinkResponse` and `UpdateTelegramRequest` to `packages/shared`, then `npm run build:shared`

## Phase 2: Foundational

- [X] T004 [P] `src/alerts/link-codes.ts`: `class LinkCodes { issue(userId, now = Date.now()) → { code, expiresAt }; redeem(code, now = Date.now()) → userId | null }`, with a 10-minute TTL, single use and a sweep on `issue`. Unit tests in `link-codes.spec.ts`.
- [X] T005 [P] `src/alerts/messages.ts`: `formatDuration(ms)`, `downMessage({ name, url, reason, since })` and `recoveredMessage({ name, url, downForMs })`, all plain text. Unit tests in `messages.spec.ts`.
- [X] T006 `src/alerts/telegram.client.ts`:
  - `available` (token set)
  - `getBotUsername()` (a cached `getMe`)
  - `sendMessage(chatId, text)`
  - `getUpdates(offset, signal)`
  - a 5 s timeout except for `getUpdates`
  - `TelegramError` carrying Telegram's `description`
  - never log the URL

## Phase 3: US1 – Connect (P1)

- [X] T007 [US1] `AlertsService`:
  - `status(userId)`
  - `createLink(userId)`: 503 if unavailable
  - `connect(code, chatId)`: redeem, then upsert `AlertChannel{ TELEGRAM, target, enabled: true }`; returns a boolean
- [X] T008 [US1] `src/alerts/telegram.poller.ts`:
  - `handleUpdate(update)`: parse `/start <code>`, call `connect`, reply using the contract's texts
  - the long-poll loop: gated as in research §1, abort on destroy, back off 5 s on errors
  - add the `ponytail:` comment
- [X] T009 [US1] `AlertsController`: `GET /alerts/telegram` and `POST /alerts/telegram/link`. `AlertsModule` registers everything, and it's added to `AppModule`.

## Phase 4: US2 – Alerts (P1)

- [X] T010 [US2] `AlertsService.onCheckRecorded(monitorId, isUp)`: the state machine from research §3, with guarded `updateMany` calls. Fire-and-forget `deliver(userId, text)` looks up the enabled TELEGRAM channel and logs failures.
- [X] T011 [US2] In `PingModule`, import `AlertsModule`. `PingService.recordResult` calls `await this.alerts.onCheckRecorded(id, result.isUp)` after the transaction when the check was saved (it needs `count` out of the transaction), wrapped in try/catch so alert errors never fail a check.
- [X] T012 [US2] `MonitorsService.update`: add `alertDownSince: null` when `urlChanged`

## Phase 5: US3 – Controls (P2)

- [X] T013 [US3] `PATCH /alerts/telegram` `{ enabled }`, `DELETE /alerts/telegram`, `POST /alerts/telegram/test` (the codes are in the contract)

## Phase 6: Tests

- [X] T014 `test/alerts.e2e-spec.ts`:
  - **Fake Telegram:** `http.createServer` answering `/bot<token>/getMe` (username `test_bot`) and `/bot<token>/sendMessage`, which records `{ chat_id, text }`. Before compiling the app, set `TELEGRAM_BOT_TOKEN='test-token'` and `TELEGRAM_API_URL=<fake>`.
  - **Connect:**
    - `GET` gives available, not connected
    - `POST link` returns a `url` starting `https://t.me/test_bot?start=`
    - `poller.handleUpdate('/start <code>', chat 4242)` creates the channel and sends a confirmation to 4242
    - the same code again gives the "expired" reply
    - `/start` alone gives the help reply
    - a code redeemed by B's chat doesn't affect A
  - **Incident cycle** (drive `ping.recordResult(id, url, result)`):
    - up, down, up (a blip): no messages
    - down, down: one DOWN message with the reason
    - down: nothing more
    - up: one RECOVERED message with "Down for"
  - **URL change while down:** PATCH the URL, then up: no RECOVERED
  - **No delivery:** a disabled channel, or no channel, sends 0 messages but the state still moves
  - **Isolation:** B's monitors never message A's chat
  - **Test message** gives 204 and a message. A fake Telegram returning `{ ok: false, description: 'Forbidden: bot was blocked by the user' }` gives 502 with that message.
  - **Unreachable Telegram:** a second app pointed at a closed port; `recordResult` for a down-down sequence completes in under 1 s and the checks are saved
  - **Toggles:** PATCH enabled false/true; DELETE → 204, then status not connected
  - **Unconfigured server:** in an app without a token, `GET` gives `available: false` and `POST link` gives 503

## Phase 7: Web

- [X] T015 `src/settings/TelegramCard.tsx` + `SettingsPage.tsx`:
  - the states: unavailable, not connected, linking (with the link and polling), connected (enabled toggle, send test, disconnect)
  - errors shown in an `ApiError` alert
  - add the `/settings` route in `App.tsx`, and a "Settings" link in the `MonitorsPage` header

## Phase 8: Polish

- [X] T016 [P] `README.md` (the alerts section, the endpoints, `TELEGRAM_BOT_TOKEN`); `CLAUDE.md` (the alerts module, the state machine, the gate, the roadmap)
- [X] T017 Run lint (API and web), unit tests, e2e tests and build
- [X] T018 Manual quickstart with a real bot (the user's BotFather token)

## Dependencies

T001–T003 → T004–T006 → US1 → US2 → US3 → T014 → T015 → Polish.

## Implementation Notes

- **No Telegram SDK:** the Bot API is called through the global `fetch`, with a 5 s timeout (30 s for long polling).
- **The fake Telegram server in e2e tests** (a plain `http.createServer`) records `sendMessage` calls and can return Telegram errors. `TELEGRAM_API_URL` points the client at it.
- **Test coverage:** all 14 alert e2e tests passed on the first run. They cover:
  - linking, single use, and the help reply
  - the blip, one DOWN and one RECOVERED per incident, and no repeats
  - a brand-new monitor that never came up
  - the silent reset on a URL change
  - alerts turned off, still tracking state
  - cross-user isolation
  - the test message and a 502 on a Telegram error
  - an unreachable Telegram: two failing checks recorded in under 1 s
  - a server with no token: `available: false` and a 503 on link
- **Totals after this feature:** 35 unit tests, 70 e2e tests, and lint clean on the API and web app.
- **No token in the web bundle:** `apps/web/dist` contains no token value; the UI only names the env variable when the feature is unavailable.
- **T018 needs a real bot**, created by the user with @BotFather and set as `TELEGRAM_BOT_TOKEN` in `apps/api/.env`.
- **T018 done by the user on 2026-09-28** with a real BotFather bot: connect, test message, down and recovered alerts, and the toggles all worked.
- **Test fix found by the user:** with a real `TELEGRAM_BOT_TOKEN` in `apps/api/.env`, the "unconfigured server" test failed. Deleting the variable from `process.env` let `ConfigModule` fall back to the `.env` value. The test now sets it to `''` (an env value takes precedence over `.env`), and `test/setup-env.ts` blanks the token for every e2e suite, so tests never reach the real Telegram. All 70 e2e tests pass with a real token present.
