# API Contracts: Alert Channels

## Overview

These contracts define the request/response shapes for configuring and testing alert channels (Slack, Discord, email).

## 1. Create/Update Alert Channel

### Request

```typescript
POST /alerts/channels
Content-Type: application/json

{
  "type": "SLACK" | "DISCORD" | "EMAIL",
  "webhookUrl": "https://hooks.slack.com/services/..." | "https://discord.com/api/webhooks/...",  // Required for SLACK/DISCORD
  "email": "user@example.com"  // Required for EMAIL
}

// Examples:

// Slack
{
  "type": "SLACK",
  "webhookUrl": "https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX"
}

// Discord
{
  "type": "DISCORD",
  "webhookUrl": "https://discord.com/api/webhooks/123456789/abcdefg"
}

// Email
{
  "type": "EMAIL",
  "email": "alerts@company.com"
}
```

### Response (201 Created)

```typescript
{
  "id": "ch-001",
  "type": "SLACK",
  "isActive": true,
  "webhookUrl": "https://hooks.slack.com/services/..." ,
  "email": null,
  "createdAt": "2026-09-30T10:00:00Z",
  "updatedAt": "2026-09-30T10:00:00Z"
}
```

### Error Responses

- **400 Bad Request**: Invalid type, missing required field, invalid URL/email format
  ```json
  {
    "status": 400,
    "messages": ["type must be one of SLACK, DISCORD, EMAIL", "webhookUrl must be a valid HTTPS URL"]
  }
  ```

- **409 Conflict**: Channel already exists for this type
  ```json
  {
    "status": 409,
    "messages": ["Alert channel of type SLACK already exists for this user"]
  }
  ```

---

## 2. List Alert Channels

### Request

```typescript
GET /alerts/channels
```

### Response (200 OK)

```typescript
[
  {
    "id": "ch-001",
    "type": "SLACK",
    "isActive": true,
    "webhookUrl": "https://hooks.slack.com/services/..." ,  // Redacted in response
    "email": null,
    "createdAt": "2026-09-30T10:00:00Z",
    "updatedAt": "2026-09-30T10:00:00Z"
  },
  {
    "id": "ch-002",
    "type": "EMAIL",
    "isActive": true,
    "webhookUrl": null,
    "email": "alerts@company.com",
    "createdAt": "2026-09-30T10:05:00Z",
    "updatedAt": "2026-09-30T10:05:00Z"
  }
]
```

**Note**: Sensitive fields (webhookUrl) are redacted in responses to prevent credential exposure in logs.

---

## 3. Test Alert Channel

### Request

```typescript
POST /alerts/channels/:id/test
Content-Type: application/json

{
  "monitorName": "API Server",
  "monitorUrl": "https://api.example.com/health",
  "status": "DOWN",
  "error": "Connection timeout"
}
```

### Response (200 OK)

```typescript
{
  "success": true,
  "message": "Test message sent successfully to Slack"
}
```

### Error Response (on delivery failure)

```typescript
{
  "success": false,
  "message": "Failed to send test message: Webhook returned 429 (rate limited). Please try again in a few minutes."
}
```

---

## 4. Delete Alert Channel

### Request

```typescript
DELETE /alerts/channels/:id
```

### Response (204 No Content)

No body.

---

## 5. Webhook Payload Format

### Slack Message Format

```json
{
  "text": "🔴 Monitor Down: API Server",
  "blocks": [
    {
      "type": "header",
      "text": {
        "type": "plain_text",
        "text": "🔴 Monitor Down"
      }
    },
    {
      "type": "section",
      "fields": [
        {
          "type": "mrkdwn",
          "text": "*Monitor:*\nAPI Server"
        },
        {
          "type": "mrkdwn",
          "text": "*URL:*\nhttps://api.example.com/health"
        },
        {
          "type": "mrkdwn",
          "text": "*Error:*\nConnection timeout"
        },
        {
          "type": "mrkdwn",
          "text": "*Time:*\n2026-09-30 10:15:30 UTC"
        }
      ]
    },
    {
      "type": "actions",
      "elements": [
        {
          "type": "button",
          "text": {
            "type": "plain_text",
            "text": "View Monitor"
          },
          "url": "https://saas-pulse.example.com/monitors/mon-123"
        }
      ]
    }
  ]
}
```

### Discord Message Format (Embed)

```json
{
  "content": "🔴 Monitor Down: API Server",
  "embeds": [
    {
      "title": "Monitor Down",
      "color": 16711680,
      "fields": [
        {
          "name": "Monitor",
          "value": "API Server"
        },
        {
          "name": "URL",
          "value": "https://api.example.com/health"
        },
        {
          "name": "Error",
          "value": "Connection timeout"
        },
        {
          "name": "Time",
          "value": "2026-09-30 10:15:30 UTC"
        }
      ],
      "footer": {
        "text": "SaaS Pulse Monitoring"
      }
    }
  ],
  "components": [
    {
      "type": 1,
      "components": [
        {
          "type": 2,
          "label": "View Monitor",
          "url": "https://saas-pulse.example.com/monitors/mon-123",
          "style": 5
        }
      ]
    }
  ]
}
```

### Email Format

```
Subject: Monitor Down: API Server
From: noreply@saas-pulse.example.com

---

🔴 Monitor Down

Monitor: API Server
URL: https://api.example.com/health
Error: Connection timeout
Time: 2026-09-30 10:15:30 UTC

View Monitor: https://saas-pulse.example.com/monitors/mon-123

---

(Recovery email has similar format with 🟢 icon and subject "Monitor Recovered")
```

---

## 6. Weekly Digest Email Format

```
Subject: Weekly Summary: Your Monitors (2026-09-24 to 2026-09-30)
From: noreply@saas-pulse.example.com

---

📊 Weekly Monitor Summary

This Week's Overview:
- Total Monitors: 5
- Fully Available (100% uptime): 3
- With Downtime: 2
- Total Downtime: 1h 24m

Monitor Status:
✅ API Server - 99.8% uptime (1 outage, 12m)
✅ Database Server - 100% uptime
✅ Cache Layer - 100% uptime
🔴 CDN Endpoint - 94.2% uptime (3 outages, 1h 12m) — Needs attention
✅ Web Dashboard - 100% uptime

Most Impacted:
1. CDN Endpoint: 3 outages, 1h 12m downtime, avg response time 250ms

Recent Incidents:
- Sep 27, 14:30 UTC: CDN Endpoint down for 40m (Connection timeout)
- Sep 25, 09:15 UTC: API Server down for 12m (High load)

Action Items:
- Review CDN Endpoint alerts
- Check resource usage patterns

---

View Full Dashboard: https://saas-pulse.example.com/monitors
Manage Alerts: https://saas-pulse.example.com/settings

(Sent by SaaS Pulse)
```
