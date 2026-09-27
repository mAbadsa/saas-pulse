# Contract: Monitors API

All routes require `Authorization: Bearer <accessToken>`. Without it they return 401 (from the global guard).

The types live in `packages/shared/src/index.ts`:

```ts
export type MonitorStatus = 'PENDING' | 'UP' | 'DOWN';

export interface MonitorResponse {
  id: string;
  name: string;
  url: string;
  intervalSeconds: number;
  isActive: boolean;
  status: MonitorStatus;
  lastCheckedAt: string | null; // ISO 8601
  createdAt: string;
  updatedAt: string;
}

export interface CreateMonitorRequest {
  name: string;
  url: string;
  intervalSeconds?: number; // default 60
}

export interface UpdateMonitorRequest {
  name?: string;
  url?: string;
  intervalSeconds?: number;
  isActive?: boolean; // false = pause, true = resume
}
```

Validation errors return `400` with `ApiErrorResponse`, where `message` is an array of field messages. Any unknown field (for example `userId`, `status`, `id` or `lastCheckedAt`) also returns `400`.

## POST /monitors

| Case | Status | Body |
|------|--------|------|
| Created | 201 | `MonitorResponse` (`status: 'PENDING'`, `isActive: true`, `lastCheckedAt: null`) |
| Invalid or unknown field | 400 | `ApiErrorResponse` |

## GET /monitors

| Case | Status | Body |
|------|--------|------|
| OK | 200 | `MonitorResponse[]`: only the caller's monitors, newest first; `[]` if there are none |

## GET /monitors/:id

| Case | Status | Body |
|------|--------|------|
| Owned | 200 | `MonitorResponse` |
| Missing, malformed id, or owned by another user | 404 | `{ statusCode: 404, message: 'Monitor not found' }` |

## PATCH /monitors/:id

| Case | Status | Body |
|------|--------|------|
| Updated | 200 | `MonitorResponse`. If the URL changed: `status: 'PENDING'`, `lastCheckedAt: null` |
| No fields provided | 400 | `{ message: 'At least one field must be provided' }` |
| Invalid or unknown field | 400 | `ApiErrorResponse` |
| Missing or not owned | 404 | `Monitor not found` |

## DELETE /monitors/:id

| Case | Status | Body |
|------|--------|------|
| Deleted, along with all its checks | 204 | (empty) |
| Missing, already deleted, or not owned | 404 | `Monitor not found` |
