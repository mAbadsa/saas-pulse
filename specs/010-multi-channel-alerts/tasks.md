# Tasks: Multi-Channel Alerts (Slack, Discord, Email, Weekly Digest)

**Input**: Design documents from `/specs/010-multi-channel-alerts/`

**Prerequisites**: plan.md (tech stack: NestJS 11, Prisma, nodemailer/SMTP, @nestjs/schedule), spec.md (4 user stories, P1-P3), data-model.md (AlertChannel, AlertLog), contracts/ (API endpoints), quickstart.md (validation scenarios)

**Tests**: E2E tests included (Jest for API, manual for email/webhook delivery). Tests are CRITICAL for multi-user isolation and delivery verification.

**Organization**: Tasks organized by user story to enable independent implementation, testing, and deployment of each channel type.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Scaffold data model, shared types, and API infrastructure

- [ ] T001 Create Prisma migration for AlertChannel type extension in `apps/api/prisma/migrations/add_multi_channel_alerts/migration.sql`
- [ ] T002 [P] Create AlertLog table migration in `apps/api/prisma/schema.prisma` with fields: id, monitorId, alertChannelId, status, channelType, deliveryStatus, errorMessage, retryCount, timestamp, completedAt
- [ ] T003 [P] Extend AlertChannel model in `apps/api/prisma/schema.prisma`: add `type` ENUM (TELEGRAM|SLACK|DISCORD|EMAIL), `webhookUrl` (nullable), `email` (nullable), unique constraint on (userId, type)
- [ ] T004 Create shared alert types in `packages/shared/src/alerts.ts`: AlertChannelType enum, AlertChannelDto, AlertLogDto, WebhookPayload interfaces
- [ ] T005 Export alert types from `packages/shared/src/index.ts`
- [ ] T006 Run `npm run prisma:generate` and `npm run build:shared` to apply schema changes

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core alert delivery infrastructure that blocks all channel implementations

**⚠️ CRITICAL**: No user story work can begin until Phase 2 is complete. All tasks below must succeed.

- [ ] T007 Create AlertsService enhancements in `apps/api/src/alerts/alerts.service.ts`: add methods for `sendAlertViaChannel(channel, monitor, status)` and `logAlertSend(monitorId, channelId, status, deliveryStatus, error?)`
- [ ] T008 Create SlackDeliveryService in `apps/api/src/alerts/slack-delivery.service.ts`: implement `sendAlert(webhookUrl, monitor, status)` and `formatSlackMessage(monitor, status)` methods
- [ ] T009 Create DiscordDeliveryService in `apps/api/src/alerts/discord-delivery.service.ts`: implement `sendAlert(webhookUrl, monitor, status)` and `formatDiscordEmbed(monitor, status)` methods
- [ ] T010 Create EmailDeliveryService in `apps/api/src/alerts/email-delivery.service.ts`: implement `sendAlert(email, monitor, status)` using nodemailer; handle SMTP config from env variables (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS)
- [ ] T011 Create WeeklyDigestService in `apps/api/src/alerts/weekly-digest.service.ts`: implement `generateDigest(userId)` method that queries 7-day monitor stats and formats email body
- [ ] T012 Add @nestjs/schedule cron job to AlertsService: `@Cron(CronExpression.EVERY_SUNDAY_AT_9AM)` for weekly digest (runs every Sunday 9 AM UTC)
- [ ] T013 Update AlertsModule in `apps/api/src/alerts/alerts.module.ts`: register SlackDeliveryService, DiscordDeliveryService, EmailDeliveryService, WeeklyDigestService
- [ ] T014 Add environment variables to `.env.example`: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS (with placeholders and comments)
- [ ] T015 Update AlertsController in `apps/api/src/alerts/alerts.controller.ts`: add POST `/alerts/channels` (create), GET `/alerts/channels` (list), DELETE `/alerts/channels/:id`, POST `/alerts/channels/:id/test` endpoints
- [ ] T016 Implement validation in AlertsService: validate webhookUrl is HTTPS URL for SLACK/DISCORD; validate email format for EMAIL type; ensure type is one of enum values
- [ ] T017 Implement retry logic in base delivery methods: exponential backoff (1s, 2s, 4s) up to 3 retries on webhook/email delivery failure

**Checkpoint**: Foundation ready - user story implementations can now proceed in parallel

---

## Phase 3: User Story 1 - Slack Webhook Alerts (Priority: P1) 🎯 MVP

**Goal**: Team members receive instant Slack notifications when monitors go down/recover

**Independent Test**: Can be tested by configuring Slack webhook, triggering down event, verifying Slack message arrives within 2 seconds

### E2E Tests for User Story 1

- [ ] T018 [P] [US1] Write E2E test in `apps/api/test/alerts.slack.e2e-spec.ts`: Create alert channel with Slack webhook URL, verify POST `/alerts/channels` returns 201 with channel data
- [ ] T019 [P] [US1] Write E2E test: Test endpoint (POST `/alerts/channels/:id/test`) sends Slack message successfully
- [ ] T020 [P] [US1] Write E2E test: Trigger monitor DOWN event, verify AlertLog record created with deliveryStatus SUCCESS
- [ ] T021 [P] [US1] Write E2E test: Verify multi-user isolation - user A's Slack alerts do not go to user B's webhook
- [ ] T022 [P] [US1] Write E2E test: Invalid webhook URL (not HTTPS) returns 400 with validation error

### Implementation for User Story 1

- [ ] T023 [US1] Enhance AlertsService.onCheckRecorded(): Call `sendAlertViaChannel()` for each active Slack channel when status changes UP↔DOWN
- [ ] T024 [US1] Implement Slack message formatting in SlackDeliveryService: include monitor name, URL, status, error message, timestamp, "View Monitor" button
- [ ] T025 [US1] Implement webhook HTTP call in SlackDeliveryService.sendAlert(): POST to webhookUrl with retry logic (exponential backoff)
- [ ] T026 [US1] Update AlertsModule: import SlackDeliveryService and register as provider
- [ ] T027 [US1] Add Slack message template in `apps/api/src/alerts/templates/slack-message.ts`: format per Slack block kit spec (from contracts/alert-channels.md)
- [ ] T028 [US1] Implement AlertLog persistence: after each send attempt, log to AlertLog table (timestamp, channel, status, deliveryStatus, errorMessage, retryCount)
- [ ] T029 [US1] Add deduplication logic: check AlertLog for duplicate DOWN alerts within 5-minute window; skip re-send if duplicate found
- [ ] T030 [US1] Add error handling: log errors to console and AlertLog; do not throw (alerts must not block monitor check flow)

**Checkpoint**: User Story 1 complete. Slack alerts work end-to-end. All E2E tests pass.

---

## Phase 4: User Story 2 - Discord Webhook Alerts (Priority: P2)

**Goal**: Teams using Discord receive instant notifications via Discord webhook embeds

**Independent Test**: Can be tested by configuring Discord webhook, triggering status change, verifying Discord message arrives

### E2E Tests for User Story 2

- [ ] T031 [P] [US2] Write E2E test in `apps/api/test/alerts.discord.e2e-spec.ts`: Create alert channel with Discord webhook, verify POST succeeds
- [ ] T032 [P] [US2] Write E2E test: Test endpoint sends Discord message with embed successfully
- [ ] T033 [P] [US2] Write E2E test: Trigger down/recovery events, verify Discord alerts sent to configured webhook
- [ ] T034 [P] [US2] Write E2E test: User with both Slack and Discord configured receives alerts on both channels independently

### Implementation for User Story 2

- [ ] T035 [US2] Implement Discord embed formatting in DiscordDeliveryService: include monitor data per Discord embed spec (from contracts/alert-channels.md)
- [ ] T036 [US2] Implement webhook HTTP call in DiscordDeliveryService.sendAlert(): POST to Discord webhooks endpoint with retry logic
- [ ] T037 [US2] Add Discord message template in `apps/api/src/alerts/templates/discord-message.ts`: format embeds with color coding (red for DOWN, green for UP)
- [ ] T038 [US2] Extend AlertsService.sendAlertViaChannel(): route to DiscordDeliveryService when channel.type === 'DISCORD'
- [ ] T039 [US2] Add validation for Discord webhook URL format in AlertsService (must be Discord webhooks endpoint)
- [ ] T040 [US2] Test webhook payload formatting against Discord API spec

**Checkpoint**: User Story 2 complete. Discord alerts work independently. Slack + Discord co-exist without interference.

---

## Phase 5: User Story 3 - Email Alerts (Priority: P2)

**Goal**: Users receive email notifications for monitor status changes with audit trail

**Independent Test**: Can be tested by configuring email recipient, triggering events, verifying emails arrive

### E2E Tests for User Story 3

- [ ] T041 [P] [US3] Write E2E test in `apps/api/test/alerts.email.e2e-spec.ts`: Create alert channel with email address, verify POST succeeds with email validation
- [ ] T042 [P] [US3] Write E2E test: Test endpoint (POST `/alerts/channels/:id/test`) sends test email successfully (uses test SMTP or mock)
- [ ] T043 [P] [US3] Write E2E test: Trigger DOWN event, verify email sent with subject "Monitor Down: [name]", body includes URL, error, timestamp
- [ ] T044 [P] [US3] Write E2E test: Trigger recovery, verify email sent with subject "Monitor Recovered: [name]" and uptime % data
- [ ] T045 [P] [US3] Write E2E test: Multiple DOWN events within 5 minutes do not generate duplicate emails

### Implementation for User Story 3

- [ ] T046 [US3] Implement email sending in EmailDeliveryService.sendAlert(): use nodemailer with SMTP config from env (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS)
- [ ] T047 [US3] Create email templates in `apps/api/src/alerts/templates/email-down.html` and `email-recovery.html`: HTML email with monitor details, links, branding
- [ ] T048 [US3] Implement email validation in AlertsService: validate email format per RFC 5322; reject invalid addresses on channel creation
- [ ] T049 [US3] Extend AlertsService.sendAlertViaChannel(): route to EmailDeliveryService when channel.type === 'EMAIL'
- [ ] T050 [US3] Implement retry logic for email delivery: up to 3 retries with exponential backoff over 1 hour
- [ ] T051 [US3] Add deduplication for email: same monitor, same recipient, same status within 5 minutes = skip re-send

**Checkpoint**: User Story 3 complete. Email alerts work independently. All three channels (Slack, Discord, Email) work together without conflicts.

---

## Phase 6: User Story 4 - Weekly Digest Email (Priority: P3)

**Goal**: Users receive weekly summary email with 7-day uptime trends and incident highlights

**Independent Test**: Can be tested by manually triggering digest generation, verifying email arrives with correct data

### E2E Tests for User Story 4

- [ ] T052 [P] [US4] Write E2E test in `apps/api/test/alerts.digest.e2e-spec.ts`: Manually trigger digest generation (POST `/alerts/digest/trigger`), verify digest email sent
- [ ] T053 [P] [US4] Write E2E test: Verify digest includes list of all user's monitors with 7-day uptime %, incident counts, average latency
- [ ] T054 [P] [US4] Write E2E test: Verify most-impacted monitor highlighted; recent incidents listed with timestamps and error messages
- [ ] T055 [P] [US4] Write E2E test: Verify digest sent exactly once per user per week (Sunday 9 AM UTC); no duplicates on retry

### Implementation for User Story 4

- [ ] T056 [US4] Implement WeeklyDigestService.generateDigest(userId): query monitors, compute 7-day uptime % (from Check table), count incidents from AlertLog
- [ ] T057 [US4] Implement digest email template in `apps/api/src/alerts/templates/digest-email.html`: formatted summary with monitor list, incident details, action items
- [ ] T058 [US4] Add @Cron scheduler to AlertsService: `@Cron(CronExpression.EVERY_SUNDAY_AT_9AM)` calls `sendDigestToAllUsers()`
- [ ] T059 [US4] Implement sendDigestToAllUsers(): iterate users, call `generateDigest(userId)`, send via EmailDeliveryService to each user's configured email channel
- [ ] T060 [US4] Track digest sends: log to AlertLog with channel type = 'EMAIL', status = 'DIGEST'; prevent duplicate sends within 7 days
- [ ] T061 [US4] Implement user opt-in preference for digest: add `digestOptIn` boolean field to AlertChannel (default true for EMAIL channels)

**Checkpoint**: User Story 4 complete. Weekly digest runs on schedule. All four alert types (Slack, Discord, Email, Digest) work end-to-end.

---

## Phase 7: Integration & Web UI

**Purpose**: Connect alert configuration UI to API, enable user management of channels

- [ ] T062 [P] Update SettingsPage in `apps/web/src/settings/SettingsPage.tsx`: add "Alert Channels" section with list of configured channels
- [ ] T063 [P] Create AlertChannelForm component in `apps/web/src/components/AlertChannelForm.tsx`: form for creating/editing Slack/Discord/Email channels
- [ ] T064 [P] Create AlertChannelList component in `apps/web/src/components/AlertChannelList.tsx`: display configured channels with toggle (active/inactive), test button, delete
- [ ] T065 [US1/US2/US3] Implement test button UI: POST to `/alerts/channels/:id/test`, show success/error toast message
- [ ] T066 [US1/US2/US3] Add form validation on web (client-side): webhook URL must be HTTPS, email must be valid format
- [ ] T067 [US1/US2/US3] Handle API errors from `/alerts/channels` endpoints: display user-friendly messages (e.g., "Slack channel already configured")
- [ ] T068 [P] Add loading states and optimistic UI updates for channel creation/deletion

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Validation, testing, documentation, and code quality

- [ ] T069 [P] Run E2E test suite: `npm run test:e2e -w @saas-pulse/api` (all alert tests must pass)
- [ ] T070 [P] Run linting: `npm run lint -w @saas-pulse/api` and `npm run lint -w @saas-pulse/web` (no violations)
- [ ] T071 [P] Run formatting check: `npm run format -w @saas-pulse/api` (confirm Prettier compliance)
- [ ] T072 [P] Verify TypeScript: `npm run build:shared && npm run build -w @saas-pulse/api && npm run build -w @saas-pulse/web` (no type errors)
- [ ] T073 Verify AlertLog table has no orphaned records: run cleanup migration if needed (cascade deletes on User/Monitor deletion)
- [ ] T074 Add API documentation comments in `apps/api/src/alerts/alerts.controller.ts` for new endpoints (JSDoc for POST/GET/DELETE channels)
- [ ] T075 Update `README.md` at project root: add "Alert Channels" section describing Slack/Discord/Email/Digest features
- [ ] T076 Update CLAUDE.md: add note about AlertsService extensions and AlertLog audit table
- [ ] T077 Test SMTP configuration with real email provider (SendGrid, AWS SES, or Gmail): ensure template rendering and delivery
- [ ] T078 Manual validation: run all 8 quickstart.md scenarios manually against dev instance
- [ ] T079 Test cross-browser WebSocket/SMTP compatibility (Chrome, Firefox, Safari)
- [ ] T080 Verify multi-user isolation: E2E test with two users, confirm alert separation in AlertLog
- [ ] T081 Load test: simulate 100+ concurrent webhook sends, verify no rate limiting issues (add to roadmap if needed)
- [ ] T082 Code cleanup: remove any console.log debug statements; ensure error messages are production-ready

---

## Dependencies & Execution Order

### Phase Dependencies

```
Setup (Phase 1)
    ↓
Foundational (Phase 2) ← BLOCKS all user stories
    ↓
┌──────────────────────────────────┐
├─ User Story 1 (Phase 3) [P1]     ├─ Can run in parallel
├─ User Story 2 (Phase 4) [P2]     ├─ after Foundation
├─ User Story 3 (Phase 5) [P2]     ├─ complete
└─ User Story 4 (Phase 6) [P3]     ┘
    ↓
Integration & Web UI (Phase 7)
    ↓
Polish (Phase 8)
```

### Within Each Phase

- **Setup**: All tasks sequential (build on each other)
- **Foundational**: Tasks can run in parallel [P] marked tasks; others sequential
- **User Stories**: Each story independent; stories can run in parallel by different developers
  - Within a story: Tests [P] first, then implementation sequential
- **Integration**: UI tasks marked [P] can run in parallel
- **Polish**: Validation/linting tasks [P] can run in parallel; documentation sequential

### User Story Dependencies

- **User Story 1 (P1)**: No dependencies on other stories; start after Foundational
- **User Story 2 (P2)**: No dependencies on US1; can start after Foundational in parallel
- **User Story 3 (P2)**: No dependencies on US1/US2; can start after Foundational in parallel
- **User Story 4 (P3)**: Depends on email delivery (US3) being complete; can start after US3

### Parallel Opportunities

**Setup Phase**:
- T002, T003, T004, T005 can run in parallel (different files, no dependencies)

**Foundational Phase**:
- T008, T009, T010 (delivery services) can run in parallel
- T018-T022, T031-T034, T041-T045, T052-T055 (E2E tests) can run in parallel

**User Stories**:
```
Developer A → User Story 1 (T023-T030)
Developer B → User Story 2 (T035-T040)
Developer C → User Story 3 (T046-T051)
Developer D → User Story 4 (T056-T061) [after US3 completes]
```

**Integration Phase**:
- T062, T063, T064, T068 (UI components) can run in parallel

**Polish Phase**:
- T069-T072 (validation, linting, build) can run in parallel
- T073-T082 (documentation, manual testing) sequential

---

## Parallel Example: All User Stories After Foundational

```bash
# Once Foundational (Phase 2) completes, launch these in parallel:

Task US1-T023: Enhance AlertsService.onCheckRecorded() for Slack
Task US2-T035: Implement Discord embed formatting
Task US3-T046: Implement email sending via nodemailer
Task US4-T056: Implement WeeklyDigestService.generateDigest()

# Each story proceeds independently; merge to main as each story completes
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. ✅ Complete Phase 1: Setup (T001-T006)
2. ✅ Complete Phase 2: Foundational (T007-T017) ← CRITICAL
3. ✅ Complete Phase 3: User Story 1 (T018-T030)
4. **STOP and VALIDATE**: Run quickstart.md Scenario 1 (Slack alerts work)
5. Test and merge to main
6. **FEATURE READY FOR DEPLOYMENT**: Slack alerts work end-to-end

**Deployment Checkpoint**: At this point, feature can be released with P1 functionality only (Slack alerts). Users can configure Slack and receive instant notifications.

### Incremental Delivery

- **Release 1 (MVP)**: Phase 1 + 2 + 3 → Slack alerts only
- **Release 2**: Add Phase 4 → Slack + Discord
- **Release 3**: Add Phase 5 → Slack + Discord + Email
- **Release 4**: Add Phase 6 → Slack + Discord + Email + Weekly Digest

Each release is independently valuable and deployable without breaking previous releases.

### Parallel Team Strategy (4+ Developers)

```
Day 1-2:
  Team: Complete Setup + Foundational together (all work on T001-T017)
    Checkpoint: Foundation ready, Phase 2 merged to main

Day 3-5:
  Developer A: User Story 1 (Slack) T018-T030
  Developer B: User Story 2 (Discord) T031-T040
  Developer C: User Story 3 (Email) T041-T051
  Developer D: User Story 4 (Digest) T052-T061 [start after US3]
  Developer E: Integration/Web UI T062-T068 [start after any story completes]

Day 6:
  Team: Regroup for integration testing (Phase 7)
  Team: Run Polish tasks (Phase 8)

Day 7:
  Team: Final validation against quickstart.md
  Team: Merge and deploy
```

---

## Task Completion Notes

### Format Verification

All tasks follow strict format:
- ✅ `- [ ]` checkbox
- ✅ Task ID (T001-T082)
- ✅ [P] for parallelizable tasks (different files, no dependencies)
- ✅ [USN] for user story tasks
- ✅ Clear description with file paths
- ✅ Dependencies noted where applicable

### Definition of Done (Per Task)

- Code written and committed
- Tests pass (if test task)
- Linting passes (`npm run lint`)
- For user stories: Independent test scenario passes from quickstart.md
- For foundational: No breaking changes to existing alerts (Telegram still works)

### Rollout Checklist (Before Merge to Main)

- [ ] Phase 1 (Setup) complete
- [ ] Phase 2 (Foundational) complete and tested
- [ ] At least User Story 1 (Slack) complete
- [ ] E2E tests pass (T018-T022 for US1, all phases for full feature)
- [ ] Quickstart.md Scenario 1 validated manually
- [ ] No breaking changes to existing Telegram alerts
- [ ] Code review complete
- [ ] CI/CD pipeline passes

---

## Notes for Implementation

- **Existing AlertsService**: Already handles Telegram; extend it to route to new delivery channels based on AlertChannel.type
- **Multi-Channel Isolation**: E2E tests CRITICAL - ensure users only receive alerts on their own configured channels
- **Timestamp Deduplication**: Use AlertLog table to detect duplicates; 5-minute window prevents alert storms from flapping monitors
- **Graceful Degradation**: Webhook/email failures must not block monitor checks; log errors and continue
- **SMTP Configuration**: Must be injected via environment variables at deployment time; never hardcode credentials
- **Weekly Digest Schedule**: @nestjs/schedule handles cron; verify timezone is UTC (no per-user timezone in v1)
- **No Database Polling**: Delivery happens inline during AlertsService.onCheckRecorded() call (synchronous); async queuing deferred to future optimization
- **Ponytail Note**: Simple in-process retry. If webhook delivery volume exceeds 1000/min, add Redis-backed queue and separate worker process.
