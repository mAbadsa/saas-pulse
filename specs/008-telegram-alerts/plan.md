# Implementation Plan: Telegram Alerts

**Branch**: `008-telegram-alerts` | **Date**: 2026-09-28 | **Spec**: [spec.md](./spec.md)

## Summary

New `AlertsModule` (API) containing:
- **`TelegramClient`:** a small `fetch` wrapper over the Bot API. The base URL is configurable so tests can point it at a fake server, and each request has a 5 s timeout.
- **`LinkCodes`:** in-memory single-use codes with a 10-minute lifetime.
- **`AlertsService`:** the incident state machine plus plain-text messages.
- **`TelegramPoller`:** a `getUpdates` long-poll loop that handles `/start <code>`.
- **`AlertsController`:** `/alerts/telegram` for status, link, toggle, disconnect and test.

`PingService.recordResult()` calls `alerts.onCheckRecorded()` after saving a check. The state change is awaited; **the Telegram send is not**. `MonitorsService.update()` clears the alert state when the URL changes.

Schema (one migration):
- new `AlertChannel` model: `userId`, `type`, `target`, `enabled`; unique on `(userId, type)`
- new `Monitor.alertDownSince DateTime?`: non-null means a down alert is outstanding, and the value is when failures started

Web: a new `/settings` page with an alerts card (connect flow with status polling, test, toggle, disconnect), and a "Settings" link in the header.

## Technical Context

- **Stack**: NestJS 11, Prisma 6, the global `fetch` in Node 24 (no Telegram SDK dependency), React 19 + shadcn
- **Storage**: Postgres. One additive migration (a new table, a new nullable column, a new enum).
- **Testing**:
  - Unit: `LinkCodes` (issue, redeem, expiry, single use); message formatting and duration
  - E2E (`alerts.e2e-spec.ts`): a fake Telegram HTTP server records `sendMessage` and answers `getMe`
    - the link flow through `poller.handleUpdate()`
    - the full incident cycle through `PingService.recordResult()`
    - no alert for a blip or with no channel/disabled; URL change clears state
    - test message; unreachable Telegram doesn't delay `recordResult`; isolation
  - Web: lint, build and a manual pass
- **Constraints**:
  - the token only lives in server env
  - plain-text messages (no `parse_mode`)
  - guarded state writes (`updateMany … where alertDownSince IS NULL`), so two cycles or instances can't send duplicates
- **Scale**: single instance (the poller and in-memory codes). The `ponytail:` notes give the upgrade path: a webhook, and codes stored in the DB or Redis.

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Workspace Boundaries | ✅ | `TelegramStatus`, `TelegramLinkResponse` and `UpdateTelegramRequest` go in `packages/shared`. |
| II. Module Structure | ✅ | `AlertsModule` (controller + services), not global. `PingModule` imports it; `MonitorsService` only clears a field. |
| III. Code Style | ✅ | Lint and CI |
| IV. Data Model | ✅ | The schema change ships as a new migration (`telegram_alerts`). |
| V. Simplicity | ✅ | No SDK or queue. Codes are an in-memory `Map`, and the poller is a plain async loop. One field holds the incident state. `ponytail:` comments mark the single-instance limits. |
| VI. Auth & Isolation | ✅ | All `/alerts/*` routes are protected, and each user can only see or change their own channel. Alerts go only to the monitor owner's channel (a join on `userId`). The Telegram poller is system work with no HTTP route. |
| Secrets | ✅ | `TELEGRAM_BOT_TOKEN` comes from env only. It's never in responses (the status gives `available: boolean`), and CI runs with it unset. |

## Project Structure

```text
apps/api/prisma/schema.prisma + migrations/<ts>_telegram_alerts/
apps/api/src/alerts/
├── alerts.module.ts
├── alerts.controller.ts      # GET/PATCH/DELETE /alerts/telegram, POST link, POST test
├── alerts.service.ts         # onCheckRecorded() state machine, status/link/test/toggle/disconnect
├── alerts.dto.ts             # UpdateTelegramDto { enabled: boolean }
├── link-codes.ts (+ .spec)   # issue / redeem
├── messages.ts (+ .spec)     # downMessage, recoveredMessage, formatDuration
├── telegram.client.ts        # getMe (cached), sendMessage, getUpdates
└── telegram.poller.ts        # long-poll loop, handleUpdate()
apps/api/src/ping/ping.service.ts        # + alerts.onCheckRecorded()
apps/api/src/ping/ping.module.ts         # imports AlertsModule
apps/api/src/monitors/monitors.service.ts# URL change clears alertDownSince
apps/api/test/alerts.e2e-spec.ts
apps/web/src/settings/SettingsPage.tsx + TelegramCard.tsx
apps/web/src/App.tsx, monitors/MonitorsPage.tsx (header link)
```

## Complexity Tracking

No violations.
