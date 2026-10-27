# Implementation Plan: Multi-Channel Alerts (Slack, Discord, Email, Weekly Digest)

**Branch**: `010-multi-channel-alerts` | **Date**: 2026-09-30 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/010-multi-channel-alerts/spec.md`

## Summary

Extend the existing AlertsService to support Slack webhooks, Discord webhooks, and email delivery. Reuse the `AlertChannel` data model (already supports Telegram) to store webhook URLs and email addresses by type. Add a scheduled job for weekly email digests. All alert delivery mechanisms follow the existing incident state machine (monitor.alertDownSince); no changes to core alerting logic, only new delivery channels.

## Technical Context

**Language/Version**: TypeScript (NestJS 11 for API, React 19 for web)

**Primary Dependencies**: 
- Backend: `@nestjs/schedule` for cron jobs (weekly digest), `nodemailer` or managed SMTP (SendGrid/AWS SES) for email delivery, `axios` for webhook HTTP calls
- Frontend: No new dependencies (webhook configuration via existing settings UI)

**Storage**: PostgreSQL 15 (Prisma schema extension: AlertChannel.type, new AlertLog table for audit trail)

**Testing**: Jest (e2e + unit for API), manual for email/webhook delivery (requires test credentials)

**Target Platform**: Linux server (backend), web browser (frontend settings UI)

**Project Type**: Web SaaS monitoring platform

**Performance Goals**: Alerts delivered within 2 seconds of status change (webhook-based); email delivery SLA per SMTP provider (typically <1 min)

**Constraints**: 
- Weekly digest must generate reliably on Sunday 9 AM UTC without missing users
- No rate limiting on initial release (added in a follow-up if needed)
- Email infrastructure must be provided at deployment time (SMTP credentials injected via env)

**Scale/Scope**: Support multiple alert channels per user; handle 100+ concurrent webhook deliveries; generate weekly digests for all users weekly

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

✅ **Workspace Boundaries**: 
- AlertChannel enhancement in Prisma schema (database only, no app-level duplicates)
- Shared types for AlertChannel variants live in `packages/shared`
- New email/webhook delivery services in `apps/api/src/alerts/`

✅ **NestJS Module Structure**: 
- AlertsModule extends to include AlertsService methods for Slack, Discord, email delivery
- WeeklyDigestService in a separate scheduled job (can be same module or separate, see design below)

✅ **Code Style**: Single quotes, Prettier, applied as written

✅ **Data Model Discipline**: 
- Prisma schema migration for AlertChannel type extension and AlertLog table (committed alongside changes)
- No ad-hoc DB changes

✅ **Simplicity (YAGNI)**: 
- Reuse existing AlertChannel model, don't create separate Slack/Discord/Email entities
- No complex retry queue initially (simple exponential backoff in-process)
- No rate limiting or advanced deduplication logic beyond 5-minute window

✅ **Auth & Tenant Isolation**: 
- Alert channels scoped by userId (existing pattern)
- Weekly digests generated per user only
- E2E tests verify cross-user isolation

**Gates Status**: All pass. No violations requiring justification.

## Project Structure

### Documentation (this feature)

```text
specs/010-multi-channel-alerts/
├── plan.md              # This file (Phase 1 output)
├── spec.md              # Feature specification
├── research.md          # Phase 0 output (None needed; tech stack clear)
├── data-model.md        # Phase 1 output (schema changes)
├── quickstart.md        # Phase 1 output (validation scenarios)
├── contracts/           # Phase 1 output (AlertChannel API contract, email templates)
├── checklists/requirements.md  # Spec validation
└── tasks.md             # Phase 2 output (/speckit-tasks command)
```

### Source Code (monorepo)

```text
apps/api/
├── src/
│   ├── alerts/
│   │   ├── alerts.service.ts          # Extended: add Slack/Discord/email methods
│   │   ├── alerts.controller.ts       # Existing: no changes (AlertsService private)
│   │   ├── slack-delivery.service.ts  # New: Slack webhook delivery
│   │   ├── discord-delivery.service.ts# New: Discord webhook delivery
│   │   ├── email-delivery.service.ts  # New: Email delivery (SMTP)
│   │   ├── weekly-digest.service.ts   # New: Cron job for Sunday 9 AM digest
│   │   └── alerts.module.ts           # Updated: register new services, add @Cron decorator
│   └── prisma/
│       └── migrations/
│           └── add_slack_discord_email_alerts/  # Prisma migration
├── test/
│   └── alerts.e2e-spec.ts             # Extended: tests for Slack/Discord/email
└── .env.example                        # Updated: add SMTP config placeholders

apps/web/
├── src/
│   └── settings/SettingsPage.tsx       # Updated: add Slack/Discord/email config UI
└── [no new files needed; reuse existing UI patterns]

packages/shared/
└── src/
    └── alerts.ts                       # New: AlertChannelType enum, email/webhook DTOs
```

**Structure Decision**: Monorepo structure unchanged. New alert delivery services as separate classes in `apps/api/src/alerts/`, each focused on one delivery mechanism (Slack, Discord, email). AlertsService orchestrates which delivery service to call based on AlertChannel.type. Weekly digest runs as a scheduled cron job in NestJS.

## Complexity Tracking

No violations to justify. Constitution all pass. Design is simple:
- Reuse existing AlertChannel model (no new entity)
- Extend existing AlertsService (no new module)
- Simple SMTP-based email (no queue/job processor)
- Basic exponential backoff retry (no distributed retry logic)
- Cron-based weekly digest (no message queue)
