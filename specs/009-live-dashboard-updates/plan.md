# Implementation Plan: Live Dashboard Updates

**Branch**: `009-live-dashboard-updates` | **Date**: 2026-09-30 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/009-live-dashboard-updates/spec.md`

## Summary

Replace 15-second polling with Socket.io real-time status and stat updates on the monitors dashboard. When a monitored service changes status or stats update, connected users see changes within 500ms. Connection establishes on page load, disconnects on unmount or tab hide. Graceful fallback to polling if Socket.io fails.

## Technical Context

**Language/Version**: TypeScript; Node.js 18+ (API), browser (web)

**Primary Dependencies**: 
- NestJS 11 (API)
- React 19 (Frontend)
- Socket.io 4.x (real-time, planned in CLAUDE.md)
- socket.io-client (React side)
- ioredis (existing, for session/state if needed)

**Storage**: PostgreSQL 15 (existing Check/Monitor data, no new schema)

**Testing**: Jest (API unit/e2e), DevTools/manual (React, no runner yet)

**Target Platform**: Browser (modern WebSocket support) + Node.js server

**Project Type**: Full-stack web service (monorepo: NestJS API + React SPA)

**Performance Goals**: Real-time updates within 500ms of server state change; auto-reconnect within 5s on network loss; polling fallback within 1s

**Constraints**: Multi-tenant isolation (user-scoped events only); low latency (WebSocket instead of polling); graceful degradation (polling is fallback, not removed)

**Scale/Scope**: Early-stage SaaS; team monitoring; assumes 1–100 concurrent connections per deployment

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Workspace Boundaries ✅
- New Socket.io module belongs in `apps/api/src/socket/` (NestJS Gateway)
- No new packages added to shared; event types live in `packages/shared` with existing models
- Web client lives in `apps/web/src/hooks/` (Socket.io hook) and components

### NestJS Module Structure ✅
- One feature module: `SocketModule` with a `SocketGateway` and `SocketService`
- Global infrastructure (Prisma, Redis) reused; no new globals
- Auth via `@CurrentUser()` on socket connection middleware
- No `@Global()` decorator on SocketModule

### Code Style ✅
- TypeScript, single quotes, Prettier format in API
- React components in web use Tailwind and shadcn patterns

### Data Model ✅
- No new tables; leverages existing `Monitor`, `Check`, `User`
- Events carry existing entity data (statusCode, latencyMs, etc.)
- No schema migration needed

### Simplicity (YAGNI) ✅
- Socket.io Gateway is the simplest real-time solution for this project
- Polling fallback is automatic (no new config needed)
- No message queue, no persistence of events (ephemeral real-time)
- Graceful degradation comment documents when to add redis-backed rooms/persistence

### Auth & Tenant Isolation ✅
- Every Socket.io event filtered by `userId` from `@CurrentUser()`
- One namespace per user or room per monitor group
- E2E tests verify cross-user events rejected

**All Constitution gates PASS.** No violations. Feature aligns with existing monorepo structure, module discipline, and auth/isolation model.

## Project Structure

### Documentation (this feature)

```text
specs/009-live-dashboard-updates/
├── plan.md              # This file (you are here)
├── research.md          # Phase 0 output (resolve dependencies & patterns)
├── data-model.md        # Phase 1 output (event schemas, monitor state)
├── contracts/           # Phase 1 output (Socket.io event definitions)
├── quickstart.md        # Phase 1 output (end-to-end validation guide)
└── tasks.md             # Phase 2 output (/speckit-tasks command)
```

### Source Code (monorepo)

```text
apps/api/                           # NestJS backend
├── src/
│   ├── socket/                      # NEW: Socket.io gateway module
│   │   ├── socket.gateway.ts        # WebSocket connection + events
│   │   ├── socket.service.ts        # Event emit logic, user scoping
│   │   ├── socket.module.ts         # Gateway registration
│   │   └── socket.events.ts         # Event type definitions
│   ├── monitors/
│   │   ├── monitors.module.ts       # Modified: import SocketModule, inject SocketService
│   │   └── monitors.service.ts      # Modified: call socketService.emitStatusChange() on status updates
│   ├── ping/
│   │   └── ping.service.ts          # Modified: call socketService.emitStatUpdate() after check recorded
│   └── app.module.ts                # Modified: register SocketModule
└── test/
    └── socket.e2e-spec.ts           # NEW: E2E tests for Socket.io auth, multi-user isolation

apps/web/                           # React frontend
├── src/
│   ├── hooks/
│   │   ├── useSocket.ts             # NEW: Socket.io connection lifecycle (connect/disconnect)
│   │   └── useMonitorUpdates.ts     # NEW: Listen to status & stat updates
│   ├── monitors/
│   │   ├── MonitorsPage.tsx         # Modified: use useMonitorUpdates instead of polling
│   │   └── StatusBadge.tsx          # No change (already updates on state change)
│   └── lib/
│       └── socket-client.ts         # NEW: Socket.io client initialization, auth, fallback logic

packages/shared/                    # Type definitions
├── src/
│   └── socket-events.ts             # NEW: Socket.io event types (StatusChangeEvent, StatUpdateEvent)
└── dist/                            # API imports from dist/

# [Tests]
# - API: jest test:e2e runs against real DB; Socket tests verify auth, multi-user isolation
# - Web: Manual verification via DevTools (no automated runner yet)
```

**Structure Decision**: Monorepo pattern with NestJS Gateway in API backend, React hooks in frontend, shared event types in packages/shared. No new projects. Socket.io module is colocated with other API features. Web integration via custom hooks and fallback to existing polling.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations. All complexity is justified and aligns with the monorepo structure and YAGNI principle:
- Socket.io Gateway is the minimal real-time solution for this use case
- Polling fallback is automatic (no config abstraction needed)
- No new projects, no repository patterns, no premature scaling
