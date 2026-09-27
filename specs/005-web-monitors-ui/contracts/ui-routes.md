# Contract: Web Routes & API Usage

## Routes

| Path | Access | Content |
|------|--------|---------|
| `/login` | public; a signed-in user is redirected to `/` | sign-in form; shows the "session expired" message when `location.state.reason === 'expired'` |
| `/register` | public; a signed-in user is redirected to `/` | registration form |
| `/` | signed in; otherwise redirected to `/login` | monitors page |
| `*` | — | redirected to `/` |

## API calls (types from `@saas-pulse/shared`)

| UI action | Request | Success |
|-----------|---------|---------|
| Register | `POST /auth/register` `RegisterRequest` | `AuthResponse` → save the session → `/` |
| Sign in | `POST /auth/login` `LoginRequest` | `AuthResponse` → save the session → `/` |
| Load / refresh the list | `GET /monitors` | `MonitorResponse[]` |
| Add | `POST /monitors` `CreateMonitorRequest` | reload the list |
| Edit | `PATCH /monitors/:id` `UpdateMonitorRequest` (changed fields only) | reload the list |
| Pause / Resume | `PATCH /monitors/:id` `{ isActive }` | reload the list |
| Delete | `DELETE /monitors/:id` | reload the list |

Errors: a non-2xx response becomes an `ApiError { status, messages: string[] }`. A 401 on any non-auth call → sign out, then `/login` with state `{ reason: 'expired' }`.
