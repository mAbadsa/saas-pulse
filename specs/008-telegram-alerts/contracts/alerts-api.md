# Contract: Alerts API

All routes are protected (global guard) and act only on the caller's own channel.

```ts
export interface TelegramStatus {
  available: boolean;        // server has a bot configured (never exposes the token)
  connected: boolean;
  enabled: boolean;          // false when not connected
  connectedAt: string | null;
}

export interface TelegramLinkResponse {
  url: string;               // https://t.me/<bot>?start=<code>
  expiresAt: string;         // ISO, 10 minutes from now
}

export interface UpdateTelegramRequest {
  enabled: boolean;
}
```

| Route | Success | Errors |
|-------|---------|--------|
| `GET /alerts/telegram` | 200 `TelegramStatus` | — |
| `POST /alerts/telegram/link` | 201 `TelegramLinkResponse` | 503 "Telegram alerts are not configured on this server"; 502 if the bot's username can't be fetched |
| `PATCH /alerts/telegram` `UpdateTelegramRequest` | 200 `TelegramStatus` | 400 invalid body; 404 "Telegram is not connected" |
| `DELETE /alerts/telegram` | 204 | 404 when not connected |
| `POST /alerts/telegram/test` | 204 (message sent) | 404 when not connected; 503 when not configured; 502 `{ message: <Telegram's description> }` |

## Bot behaviour (outbound, plain text)

| Incoming | Reply |
|----------|-------|
| `/start <valid code>` | "✅ Connected to SaaS Pulse. You'll get a message here when a monitor goes down or recovers." |
| `/start <expired/used code>` | "This link has expired. Open SaaS Pulse → Settings → Connect Telegram to get a new one." |
| anything else | "To get alerts, open SaaS Pulse → Settings → Connect Telegram." |

## Configuration

| Variable | Default | Notes |
|----------|---------|-------|
| `TELEGRAM_BOT_TOKEN` | unset (feature unavailable) | From BotFather. **Secret**: untracked `.env` only. |
| `TELEGRAM_API_URL` | `https://api.telegram.org` | Overridden in tests only. |
