# Feature Specification: Multi-Channel Alerts

**Feature Branch**: `010-multi-channel-alerts`

**Created**: 2026-09-30

**Status**: Draft

**Input**: User description: "Slack and Discord webhook alerts, plus email alerts with a weekly digest"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Slack Webhook Alerts (Priority: P1)

Team members receive instant Slack notifications when a monitor goes down and when it recovers, keeping the entire team aware of infrastructure issues in real-time without leaving Slack.

**Why this priority**: Slack integration provides immediate team-wide visibility of monitor status changes, enabling faster response to incidents. Most monitoring tools start with Slack as the primary notification channel.

**Independent Test**: Can be fully tested by: connect Slack webhook to a monitor, trigger a down event, verify instant Slack message arrives with monitor name/URL/status, then trigger recovery and verify recovery message. Delivers value independently of other alert channels.

**Acceptance Scenarios**:

1. **Given** a user has configured a Slack webhook URL in monitor settings, **When** the monitor goes down, **Then** a Slack message is sent immediately to the configured channel with monitor name, URL, error details, and timestamp
2. **Given** a monitor is in DOWN state and recovers, **When** the next check confirms UP status, **Then** a Slack recovery message is sent to the channel
3. **Given** a user has not configured Slack alerts, **When** a monitor status changes, **Then** no Slack messages are sent
4. **Given** multiple monitors are connected to the same Slack webhook, **When** any monitor status changes, **Then** the webhook receives the correct monitor's alert (no cross-monitor pollution)

---

### User Story 2 - Discord Webhook Alerts (Priority: P2)

Team members using Discord receive instant notifications when monitors go down and recover, providing an alternative to Slack for teams with Discord-only infrastructure.

**Why this priority**: Discord is a viable alternative to Slack used by many development teams, especially in the startup and gaming communities. Second priority after Slack due to smaller installed base.

**Independent Test**: Can be fully tested by: connect Discord webhook URL, trigger status changes, verify Discord embeds/messages appear with correct formatting and data. Same scenario structure as Slack. Independently deployable and testable.

**Acceptance Scenarios**:

1. **Given** a user has configured a Discord webhook URL, **When** the monitor goes down, **Then** a Discord message (or embed) is sent immediately with monitor details and status
2. **Given** a monitor recovers, **When** the status changes to UP, **Then** a Discord recovery notification is sent
3. **Given** a user has configured both Slack and Discord webhooks, **When** a monitor status changes, **Then** both Slack and Discord receive alerts independently

---

### User Story 3 - Email Alerts (Priority: P2)

Users receive email notifications when monitors go down and recover, providing an audit trail and a channel that doesn't rely on team chat tools.

**Why this priority**: Email is a reliable fallback and provides a formal record of incidents. Equally important as Discord for users who want decoupled notification channels.

**Independent Test**: Can be fully tested by: configure email recipient, trigger a down event, verify email arrives with subject line, monitor details, and next steps. Then trigger recovery and verify recovery email. Works independently without Slack/Discord.

**Acceptance Scenarios**:

1. **Given** a user has configured email alerts, **When** a monitor goes down, **Then** an email is sent to the configured address with subject "Monitor Down: [Monitor Name]", monitor URL, error message, and time threshold before alert
2. **Given** a monitor recovers, **When** status changes to UP, **Then** a recovery email is sent with subject "Monitor Recovered: [Monitor Name]" and uptime percentage
3. **Given** a monitor status oscillates (down→up→down), **When** alerts are sent, **Then** duplicate consecutive alerts are not sent within 5 minutes (deduplication window)

---

### User Story 4 - Weekly Digest Email (Priority: P3)

Users receive a weekly email summary of all monitor status, uptime trends, and incidents, providing business stakeholders a high-level view without daily alert noise.

**Why this priority**: Digestes reduce alert fatigue and provide executive visibility. Lower priority than real-time alerts but valuable for weekly reviews and SLA tracking.

**Independent Test**: Can be fully tested by: trigger digest generation (on a weekly schedule), verify email includes list of all monitors with uptime %, incident count, most-impacted monitors, and links to detail pages. Independently deployable.

**Acceptance Scenarios**:

1. **Given** a user has opted in to weekly digest, **When** Sunday 9:00 AM UTC arrives, **Then** a digest email is sent with: list of all monitors with 7-day uptime %, down event count, average response time, and incidents summary
2. **Given** a monitor had no downtime during the week, **When** the digest is generated, **Then** the monitor shows 100% uptime with a checkmark
3. **Given** multiple monitors experienced downtime, **When** the digest is generated, **Then** incidents are listed by severity/duration, highlighting the most-impacted monitor

---

### Edge Cases

- What happens if a Slack/Discord webhook URL is invalid or the service is unreachable? System should log the error, retry with exponential backoff, and alert the user in the dashboard
- How does the system handle Slack/Discord rate limits? Batch alerts or queue them if rate limit is hit
- What happens if email delivery fails? Log the failure and allow manual retry from the dashboard
- How are alerts handled if a user deletes an alert channel configuration mid-incident? The alert is still delivered (no orphaning)
- What if a monitor is paused during an incident? Paused monitors should not send alerts

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow users to configure a Slack webhook URL per AlertChannel record (reusing existing AlertChannel data model)
- **FR-002**: System MUST allow users to configure a Discord webhook URL per AlertChannel record
- **FR-003**: System MUST allow users to configure email recipient(s) per AlertChannel record
- **FR-004**: System MUST send a Slack message to the configured webhook when a monitor transitions from UP to DOWN or DOWN to UP
- **FR-005**: System MUST send a Discord message/embed to the configured webhook when a monitor status changes
- **FR-006**: System MUST send an email to the configured recipient when a monitor goes down or recovers
- **FR-007**: System MUST generate and send a weekly digest email to opted-in users every Sunday at 9:00 AM UTC with 7-day uptime, incident counts, and trending data
- **FR-008**: System MUST deduplicate alerts: if a monitor stays DOWN for more than 5 minutes without recovery, do not send duplicate DOWN alerts
- **FR-009**: System MUST include monitor name, URL, status, error message (if DOWN), and timestamp in all alert messages
- **FR-010**: System MUST support multiple alert channels per user (e.g., both Slack and email)
- **FR-011**: System MUST not send alerts for paused monitors (isActive=false)
- **FR-012**: System MUST retry failed webhook/email deliveries with exponential backoff (up to 3 retries over 1 hour)

### Key Entities *(include if feature involves data)*

- **AlertChannel**: Already exists; will extend with `type` field (TELEGRAM|SLACK|DISCORD|EMAIL), webhook URL for webhooks, email address for email type
- **AlertLog** (new): Audit trail of all alert sends—timestamp, channel, monitor, status, delivery status (success/failed), retry count. Used for debugging and analytics.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can configure Slack/Discord/email alerts within 2 minutes from the settings page
- **SC-002**: Alerts are delivered within 2 seconds of monitor status change (webhook-based; email may be slower due to mail infrastructure)
- **SC-003**: 99% of alert sends succeed on the first attempt (measured over 7 days)
- **SC-004**: Weekly digest emails are generated and sent on schedule with 99% reliability
- **SC-005**: Alert configuration UI provides clear feedback on webhook/email validity (test button)
- **SC-006**: Users report reduced alert fatigue through weekly digest adoption (target: 60% of users opt in within 30 days of release)

## Assumptions

- **Email infrastructure**: A mail service is available for sending emails (SMTP or managed email provider like SendGrid). The API will be configured with credentials at deployment time.
- **Webhook retries**: Webhook failures are transient (network blips, temporary service unavailability). Retry up to 3 times over 1 hour before giving up.
- **Weekly digest schedule**: All users receive digest on the same schedule (Sunday 9 AM UTC). Per-user timezone selection is out of scope for v1.
- **Alert channels are user-owned**: Each user manages their own alert channels; no team-wide shared channels in v1. Team notifications happen by each team member configuring their own webhook.
- **Backward compatibility**: Existing Telegram alerts continue to work. New channels are additive only.
- **Existing monitoring engine**: Leverages the existing AlertsService incident state machine (monitor.alertDownSince); no changes to core alert logic, only new delivery channels.
- **Rate limiting deferred**: Slack/Discord rate limiting is handled at the API level (queue-based delivery if needed), not blocking the initial feature.
