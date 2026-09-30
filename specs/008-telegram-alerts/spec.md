# Feature Specification: Telegram Alerts

**Feature Branch**: `008-telegram-alerts`

**Created**: 2026-09-28

**Status**: Draft

**Input**: User description: "Alerts (roadmap phase 3), starting with Telegram: notify a user on Telegram when one of their monitors goes down and when it recovers — only on status changes, with a confirmation threshold to avoid false alarms. Users connect their Telegram from a settings page and can send a test message."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Connect my Telegram (Priority: P1)

A signed-in user connects their Telegram account to SaaS Pulse from a settings page, so alerts can reach them, without having to find or type any technical identifiers.

**Why this priority**: Nothing can be delivered until SaaS Pulse knows where to send alerts.

**Independent Test**: On the settings page, choose "Connect Telegram", follow the link, press Start in Telegram, and see the settings page switch to "Connected" on its own. Telegram shows a confirmation message from the bot.

**Acceptance Scenarios**:

1. **Given** a signed-in user without Telegram connected, **When** they choose "Connect Telegram", **Then** they get a link that opens the SaaS Pulse bot in Telegram, and instructions to press Start.
2. **Given** they open the link and press Start within 10 minutes, **When** the bot receives it, **Then** their account is connected, the bot replies with a confirmation, and the settings page shows "Connected" without a manual reload.
3. **Given** a link older than 10 minutes, or one that has already been used, **When** someone presses Start with it, **Then** nothing is connected and the bot replies that the link has expired and a new one should be generated in SaaS Pulse.
4. **Given** someone messages the bot directly without a valid link, **When** the bot receives it, **Then** it replies with a short explanation of how to connect from SaaS Pulse.
5. **Given** the server has no Telegram bot configured, **When** a user opens the settings page, **Then** they see that Telegram alerts aren't available on this server, instead of a broken connect button.

---

### User Story 2 - Get told when a monitor goes down and when it recovers (Priority: P1)

A connected user gets a Telegram message when one of their monitors goes down, and another when it comes back up. Each message says which monitor, its URL, and why it's down or how long it was down. Nothing else is sent: no message for every failed check.

**Why this priority**: This is the whole point of alerts. A monitoring product that needs to be watched isn't doing its job.

**Independent Test**: With Telegram connected, point a monitor at a URL that starts failing. After two consecutive failed checks, exactly one "down" message arrives. When the URL recovers, exactly one "recovered" message arrives, stating the downtime duration.

**Acceptance Scenarios**:

1. **Given** a connected user and a monitor that has been up, **When** 2 consecutive checks fail, **Then** one "down" message is sent. It names the monitor, its URL and the failure reason (HTTP status or error message).
2. **Given** a single failed check followed by a successful one (a blip), **When** those checks happen, **Then** no message is sent.
3. **Given** a monitor for which a "down" message was sent, **When** further checks keep failing, **Then** no further messages are sent.
4. **Given** a monitor for which a "down" message was sent, **When** a check succeeds, **Then** one "recovered" message is sent, stating how long the monitor was down.
5. **Given** a user who hasn't connected Telegram, or has turned alerts off, **When** their monitors go down or recover, **Then** nothing is sent, and monitoring otherwise continues normally.
6. **Given** a monitor whose URL is edited while it is in a "down" state, **When** the edit is saved, **Then** the down state is cleared silently, with no "recovered" message for the old address.
7. **Given** a brand-new monitor whose very first checks fail, **When** 2 consecutive checks fail, **Then** a "down" message is sent. There doesn't have to be an earlier "up".

---

### User Story 3 - Control and verify my alerts (Priority: P2)

A connected user can send themselves a test message, turn alerts off and on without disconnecting, and disconnect Telegram entirely.

**Why this priority**: Users need to trust that alerts will arrive, and to silence them temporarily, but the basic alerting works without these controls.

**Independent Test**: Press "Send test message" and receive it in Telegram. Turn alerts off, trigger a failure, and receive nothing. Turn them back on. Disconnect, and see the page go back to "Connect Telegram".

**Acceptance Scenarios**:

1. **Given** a connected user, **When** they press "Send test message", **Then** a test message arrives in Telegram and the page confirms it was sent. If sending fails (for example, they blocked the bot), the page shows the reason.
2. **Given** a connected user, **When** they turn alerts off, **Then** no alerts are sent until they turn them back on, and the connection is kept.
3. **Given** a connected user, **When** they disconnect, **Then** the connection is removed and no alerts are sent. Reconnecting requires a new link.

---

### Edge Cases

- **Monitor or account deleted while down:** no "recovered" message is sent. Deleting the monitor removes its alert state with it.
- **Telegram unreachable or rejects a message** (for example, the user blocked the bot): the failure is logged, monitoring is never delayed or broken by it, and the incident isn't retried later.
- **Paused while down:** no checks run, so no messages. If it's resumed and succeeds, the "recovered" message is sent then.
- **Unsafe characters:** monitor names or URLs with special characters are sent as plain text and can't change the message's formatting.
- **One chat, several accounts:** the same Telegram chat may be connected to more than one SaaS Pulse account, and each account's alerts arrive there.
- **Many monitors changing state at once:** each one sends its own message. Telegram's per-chat rate limits aren't a concern at this scale.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST let a signed-in user generate a single-use Telegram connect link that expires after 10 minutes and opens the SaaS Pulse bot.
- **FR-002**: When the bot receives Start with a valid link, the system MUST store that Telegram chat as the user's alert destination and reply with a confirmation. Invalid or expired links MUST be rejected with an explanatory reply.
- **FR-003**: The system MUST send a "down" alert when a monitor's checks fail 2 times in a row and no down alert is outstanding for it.
- **FR-004**: The system MUST send a "recovered" alert, with the downtime duration, on the first successful check after a down alert, and then clear the outstanding state.
- **FR-005**: At most one down alert and one recovered alert may be sent per incident. Blips shorter than the threshold MUST NOT alert.
- **FR-006**: Changing a monitor's URL MUST clear its outstanding down state without sending anything.
- **FR-007**: Alerts MUST be sent only to the monitor owner's connected, enabled Telegram destination.
- **FR-008**: Users MUST be able to see their connection status, send a test message, turn alerts on and off, and disconnect.
- **FR-009**: Alert delivery failures MUST NOT delay, fail or skip checks, and MUST be logged.
- **FR-010**: Messages MUST be sent as plain text: monitor name, URL, reason or downtime, and the event type.
- **FR-011**: If the server has no Telegram bot configured, the feature MUST report itself as unavailable, and everything else MUST keep working.
- **FR-012**: The bot token MUST come from server configuration and MUST never be committed or sent to clients.

### Key Entities

- **Alert channel**: a user's alert destination. It holds its type (Telegram for now; built to allow email and webhooks later), the destination identifier (the Telegram chat), whether it's enabled, and when it was connected. There is at most one per type per user.
- **Connect link**: a short-lived, single-use code tied to a user, used to connect a Telegram chat.
- **Monitor alert state**: whether a down alert is outstanding for a monitor, and since when.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can connect Telegram in under 1 minute, without typing any identifier.
- **SC-002**: A down alert arrives within 1 check interval plus 30 seconds after the second consecutive failed check, and a recovered alert within 30 seconds of the first successful check afterwards.
- **SC-003**: In automated tests with a simulated Telegram service, 0 duplicate alerts are sent per incident, and 0 alerts are sent for single-check blips.
- **SC-004**: In automated tests, an unreachable Telegram service causes 0 failed or delayed checks.
- **SC-005**: The bot token appears in 0 API responses, 0 client bundles and 0 committed files.

## Assumptions

- **The operator creates the bot.** The person running SaaS Pulse creates a Telegram bot (through BotFather) and puts its token in the server configuration. End users never see the token.
- **Receiving messages by polling:** the server receives Start messages by polling Telegram, not through a webhook. That works locally and behind firewalls without a public HTTPS address. A single API instance is assumed; a webhook is the upgrade path for multiple instances.
- **Fixed confirmation threshold:** the threshold is 2 consecutive failed checks. Making it configurable per monitor, and repeating alerts while something stays down, are out of scope.
- **Other channels later:** email, Slack/Discord webhooks and the weekly digest are future work that reuses the alert-channel model.
- **Connect links live in server memory,** so a restart invalidates unused links; users just generate a new one.
