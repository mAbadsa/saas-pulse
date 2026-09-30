# Data Model: Multi-Channel Alerts

## Overview

This feature extends the existing `AlertChannel` model to support multiple alert delivery mechanisms (Slack webhooks, Discord webhooks, email, and existing Telegram). A new `AlertLog` table provides an audit trail of all alert sends.

## Entities

### AlertChannel (Extended)

**Purpose**: Stores user-configured alert destination and credentials, one per user per channel type.

**Fields**:
- `id` (UUID, primary key)
- `userId` (UUID, foreign key → User) — User who owns this channel
- `type` (ENUM: 'TELEGRAM' | 'SLACK' | 'DISCORD' | 'EMAIL') — Channel type
- `webhookUrl` (String, nullable) — Slack/Discord webhook URL. Must be a valid HTTPS URL. Required for SLACK and DISCORD types, null for others.
- `email` (String, nullable) — Email recipient address. Must be a valid email format per RFC 5322. Required for EMAIL type, null for others.
- `isActive` (Boolean, default true) — User can disable the channel without deleting it
- `createdAt` (DateTime) — When the channel was configured
- `updatedAt` (DateTime) — Last modification

**Validation Rules**:
- `type` must be one of the 4 enum values
- If `type === 'SLACK'` or `'DISCORD'`, `webhookUrl` MUST be a non-empty HTTPS URL
- If `type === 'EMAIL'`, `email` MUST be a non-empty valid email address
- For `type === 'TELEGRAM'`, both `webhookUrl` and `email` are null (existing Telegram implementation stores token elsewhere)
- Unique constraint: `(userId, type)` — one channel per user per type
- `createdAt` and `updatedAt` managed by Prisma

**Relationships**:
- `user` → User (many-to-one)
- `alerts` → AlertLog (one-to-many)

**Example Records**:
```
{
  id: "ch-001",
  userId: "user-123",
  type: "SLACK",
  webhookUrl: "https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX",
  email: null,
  isActive: true,
  createdAt: "2026-09-30T10:00:00Z",
  updatedAt: "2026-09-30T10:00:00Z"
}

{
  id: "ch-002",
  userId: "user-123",
  type: "EMAIL",
  webhookUrl: null,
  email: "user@example.com",
  isActive: true,
  createdAt: "2026-09-30T10:05:00Z",
  updatedAt: "2026-09-30T10:05:00Z"
}
```

### AlertLog (New)

**Purpose**: Audit trail of all alert sends. Used for debugging, analytics, and manual retry if needed.

**Fields**:
- `id` (UUID, primary key)
- `monitorId` (UUID, foreign key → Monitor) — Monitor that triggered the alert
- `alertChannelId` (UUID, foreign key → AlertChannel) — Channel through which alert was sent
- `status` ('UP' | 'DOWN' | 'PENDING') — Monitor status when alert was sent
- `channelType` ('TELEGRAM' | 'SLACK' | 'DISCORD' | 'EMAIL') — Denormalized for query efficiency
- `deliveryStatus` ('SUCCESS' | 'FAILED' | 'RETRYING') — Outcome of send attempt
- `errorMessage` (String, nullable) — Error details if delivery failed (e.g., "Webhook returned 429 - rate limited")
- `retryCount` (Integer, default 0) — Number of retry attempts
- `timestamp` (DateTime) — When alert was sent (or first attempt if retrying)
- `completedAt` (DateTime, nullable) — When final attempt succeeded or was abandoned

**Indexes**:
- `(monitorId, timestamp)` — Query alerts for a monitor
- `(alertChannelId, timestamp)` — Query delivery history for a channel
- `(deliveryStatus)` — Find failed/retrying alerts for manual intervention

**Relationships**:
- `monitor` → Monitor (many-to-one)
- `alertChannel` → AlertChannel (many-to-one)

**Example Record**:
```
{
  id: "log-001",
  monitorId: "mon-123",
  alertChannelId: "ch-001",
  status: "DOWN",
  channelType: "SLACK",
  deliveryStatus: "SUCCESS",
  errorMessage: null,
  retryCount: 0,
  timestamp: "2026-09-30T10:15:30Z",
  completedAt: "2026-09-30T10:15:31Z"
}
```

## Schema Changes

### Prisma Migration

```prisma
// Migration: add_multi_channel_alerts

model AlertChannel {
  id            String   @id @default(cuid())
  userId        String
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  type          AlertChannelType  // ENUM: TELEGRAM, SLACK, DISCORD, EMAIL
  webhookUrl    String?   // For SLACK/DISCORD
  email         String?   // For EMAIL
  isActive      Boolean   @default(true)
  
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  
  logs          AlertLog[]
  
  @@unique([userId, type])  // One channel per user per type
  @@index([userId])
}

model AlertLog {
  id                String    @id @default(cuid())
  monitorId         String
  monitor           Monitor   @relation(fields: [monitorId], references: [id], onDelete: Cascade)
  
  alertChannelId    String
  alertChannel      AlertChannel @relation(fields: [alertChannelId], references: [id], onDelete: SetNull)
  
  status            String    // UP, DOWN, PENDING
  channelType       AlertChannelType  // Denormalized for query efficiency
  deliveryStatus    String    // SUCCESS, FAILED, RETRYING
  errorMessage      String?
  retryCount        Int       @default(0)
  
  timestamp         DateTime  @default(now())
  completedAt       DateTime?
  
  @@index([monitorId, timestamp])
  @@index([alertChannelId, timestamp])
  @@index([deliveryStatus])
}

enum AlertChannelType {
  TELEGRAM
  SLACK
  DISCORD
  EMAIL
}
```

## Data Integrity Rules

1. **Alert delivery is idempotent**: If AlertLog record exists for a (monitorId, alertChannelId, timestamp), do not re-send
2. **Deduplication window**: Do not send duplicate DOWN alerts within 5 minutes for the same monitor on the same channel
3. **User isolation**: Queries always filter AlertChannel and AlertLog by userId to prevent cross-user data leaks
4. **Cascade deletes**: Deleting a User removes their AlertChannels and AlertLogs; deleting a Monitor removes its AlertLogs
5. **Type validation at application level**: ORM validates webhookUrl format for SLACK/DISCORD, email format for EMAIL

## Relationships

```
User
  ├─ AlertChannel (one-to-many)
  │  └─ AlertLog (via alertChannel)
  └─ Monitor
     └─ AlertLog (one-to-many)
```
