# Data Model: Telegram Alerts

One additive migration, `telegram_alerts`.

```prisma
enum AlertChannelType {
  TELEGRAM
}

model AlertChannel {
  id        String           @id @default(cuid())
  userId    String
  user      User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  type      AlertChannelType
  target    String           // Telegram chat id (as a string)
  enabled   Boolean          @default(true)
  createdAt DateTime         @default(now())   // "connected at"
  updatedAt DateTime         @updatedAt

  @@unique([userId, type])
}

model User    { ...; alertChannels AlertChannel[] }
model Monitor { ...; alertDownSince DateTime? }   // null = no outstanding down alert
```

## Incident states (per monitor)

| `alertDownSince` | Event | Next | Sends |
|---|---|---|---|
| null | a check fails and the previous check also failed (2 in a row) | the older failure's time | DOWN (if an enabled channel exists) |
| null | a check fails and the previous check was up or missing | null | — |
| null | a check is up | null | — |
| set | a check fails | unchanged | — |
| set | a check is up | null | RECOVERED with `now − alertDownSince` |
| set | the URL is changed through PATCH | null | — |

Cascades: deleting a user removes their channels. Deleting a monitor removes its state along with the row.
