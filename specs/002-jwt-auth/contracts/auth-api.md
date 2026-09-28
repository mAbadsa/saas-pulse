# Contract: Auth API

The TypeScript types live in `packages/shared/src/index.ts`:

```ts
export interface RegisterRequest { email: string; password: string; name?: string }
export interface LoginRequest    { email: string; password: string }
export interface UserProfile     { id: string; email: string; name: string | null }
export interface AuthResponse    { accessToken: string; user: UserProfile }
```

Errors use the existing `ApiErrorResponse` shape: `{ statusCode, message, error? }`. For validation errors, `message` is an array of strings, one per invalid field.

## POST /auth/register (public)

| Case | Status | Body |
|------|--------|------|
| Success | 201 | `AuthResponse` |
| Invalid email, password < 8 chars or > 72 bytes, or unknown field | 400 | `ApiErrorResponse` (field messages) |
| Email already registered (case-insensitive) | 409 | `{ statusCode: 409, message: 'Email already in use' }` |

## POST /auth/login (public)

| Case | Status | Body |
|------|--------|------|
| Success | 200 | `AuthResponse` |
| Wrong password **or** unknown email | 401 | `{ statusCode: 401, message: 'Invalid email or password' }`, the same in both cases |
| Malformed body | 400 | `ApiErrorResponse` |

## GET /auth/me (protected)

Header: `Authorization: Bearer <accessToken>`

| Case | Status | Body |
|------|--------|------|
| Valid token, user exists | 200 | `UserProfile` |
| Missing, malformed, wrongly signed or expired token, or deleted user | 401 | `{ statusCode: 401, message: 'Unauthorized' }` |

## Public endpoints

These work without a token: `GET /`, `GET /health`, `POST /auth/register`, `POST /auth/login`. **Every other endpoint, existing or future, returns 401 without a valid token.**
