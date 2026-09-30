# Quickstart: Validate Telegram Alerts

## One-time operator setup (creating the bot)

1. In Telegram, message **@BotFather** and send `/newbot`. Choose a name and a username ending in `bot`, for example `saaspulse_dev_bot`.
2. Copy the token it gives you into `apps/api/.env` (untracked):
   ```
   TELEGRAM_BOT_TOKEN=123456789:AA...
   ```
3. Restart `npm run dev:api`. The log should show the Telegram poller starting.

## Automated

```bash
npm run test -w @saas-pulse/api       # link codes, message formatting
npm run test:e2e -w @saas-pulse/api   # alerts.e2e-spec.ts against a fake Telegram server
```

## Manual (browser + Telegram)

1. Web app → **Settings** → **Connect Telegram** → **Open Telegram** → press **Start**. The bot confirms, and within about 3 s the page shows **Connected**.
2. **Send test message**: it arrives in Telegram.
3. Add a monitor for `https://httpstat.us/503`, or any URL that fails, with a 30 s interval. After about 1 minute (2 failures) you get one **🔴 DOWN** message, and no more while it stays down.
4. Edit it to `https://example.com`. The URL change clears the incident silently, and no recovered message is sent. Alternatively, restore a URL that works: the next successful check sends **🟢 RECOVERED** with the duration.
5. Turn alerts **off**, repeat step 3, and nothing arrives. Turn them back on.
6. **Disconnect**: the page shows "Connect Telegram" again.
7. Without `TELEGRAM_BOT_TOKEN`, the settings page says Telegram alerts aren't available on this server.
