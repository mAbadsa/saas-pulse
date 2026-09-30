# Quickstart: Multi-Channel Alerts Validation

**Purpose**: Runnable validation scenarios to verify each alert channel works end-to-end

**Prerequisites**:
- SaaS Pulse API and web app running locally (`npm run dev:api` and `npm run dev:web`)
- Authenticated user account
- At least one active monitor
- Test credentials for each channel (see below)

---

## Scenario 1: Slack Webhook Alert

**Objective**: Verify Slack webhook integration delivers instant notifications

**Test Credentials Required**:
- A Slack workspace where you can create webhooks
- Incoming Webhook URL from Slack (create via [Slack Apps](https://api.slack.com/apps) → Incoming Webhooks)

**Steps**:

1. Navigate to `/settings` (Settings page)
2. Scroll to "Alert Channels" section
3. Click "Add Channel" → select "Slack"
4. Paste your Slack webhook URL
5. Click "Test" button → verify Slack message appears in the channel
6. Click "Save"
7. Trigger a monitor down event:
   - Via CLI: `npm run --prefix apps/api -- ping:trigger-failure <monitorId>`
   - Or wait for next scheduled check to fail
8. **Expected**: Slack message arrives within 2 seconds with:
   - Monitor name, URL, error message
   - "View Monitor" button linking to detail page
9. Trigger recovery: monitor status changes to UP
10. **Expected**: Recovery message in Slack

**Pass Criteria**:
- [ ] Test message delivered successfully
- [ ] Real down event generates Slack alert
- [ ] Recovery event generates Slack alert
- [ ] Multiple monitors send correct monitor-specific alerts

---

## Scenario 2: Discord Webhook Alert

**Objective**: Verify Discord webhook integration works

**Test Credentials Required**:
- A Discord server where you can create webhooks
- Incoming Webhook URL from Discord (create via Server Settings → Integrations → Webhooks)

**Steps**:

1. Navigate to `/settings`
2. Click "Add Channel" → select "Discord"
3. Paste Discord webhook URL
4. Click "Test" → verify Discord embed message appears
5. Click "Save"
6. Trigger a monitor down event (same as Scenario 1)
7. **Expected**: Discord embed arrives with formatted monitor data
8. Verify recovery message also arrives

**Pass Criteria**:
- [ ] Test message delivered
- [ ] Down/recovery events generate Discord alerts
- [ ] Multiple channels (Slack + Discord) both receive alerts independently

---

## Scenario 3: Email Alert (Down/Recover)

**Objective**: Verify email delivery for status changes

**Test Credentials Required**:
- Test email address (e.g., your inbox or a test account)
- SMTP credentials configured in API `.env` (SendGrid, Gmail, etc.)

**Steps**:

1. Navigate to `/settings`
2. Click "Add Channel" → select "Email"
3. Enter test email address
4. Click "Test" → check email inbox for test message
5. Click "Save"
6. Trigger a monitor down event
7. **Expected**: Email arrives with:
   - Subject: "Monitor Down: [Name]"
   - Body includes URL, error details, timestamp
8. Trigger recovery
9. **Expected**: Recovery email arrives with:
   - Subject: "Monitor Recovered: [Name]"
   - Uptime % shown

**Pass Criteria**:
- [ ] Test email delivered to inbox (may take 1-60 seconds)
- [ ] Down event generates down email
- [ ] Recovery event generates recovery email
- [ ] Multiple alerts within 5 minutes do not create duplicate emails

---

## Scenario 4: Deduplication (Same Channel, Multiple Alerts)

**Objective**: Verify alerts are not duplicated within 5-minute window

**Setup**:
- Monitor configured with Slack + Email alerts
- Monitor currently UP

**Steps**:

1. Manually trigger down event (via ping endpoint or wait for failure)
2. **Expected**: Both Slack and Email alerts arrive
3. Wait 2 minutes (monitor still DOWN)
4. Manually trigger another down event
5. **Expected**: No new Slack or Email alert (within 5-minute dedup window)
6. Wait 4 more minutes (total 6 minutes)
7. Manually trigger down event again
8. **Expected**: New alerts arrive (dedup window expired)

**Pass Criteria**:
- [ ] First down alert delivers to all channels
- [ ] Duplicate down within 5 min does not re-alert
- [ ] After 5 min expires, new alert delivers again

---

## Scenario 5: Weekly Digest Email

**Objective**: Verify weekly digest generates and sends

**Setup**:
- Monitor with at least 7 days of check history
- Some monitors with uptime data
- Email alert channel configured

**Steps**:

1. **Trigger digest generation** (manual for testing, normally runs on Sunday 9 AM):
   - Call API: `POST /alerts/digest/trigger` (admin endpoint for testing)
   - Or wait until next scheduled Sunday 9 AM UTC
2. **Expected**: Email arrives with:
   - Subject: "Weekly Summary: Your Monitors (YYYY-MM-DD to YYYY-MM-DD)"
   - List of all monitors with uptime %, incident counts
   - Most-impacted monitor highlighted
   - Recent incidents listed
   - Action items if any
3. Verify data accuracy:
   - Uptime % matches dashboard 7-day view
   - Incident count matches alert log

**Pass Criteria**:
- [ ] Digest email generated and delivered
- [ ] Content includes all required sections
- [ ] Uptime % data is accurate
- [ ] Incidents listed with correct timestamps
- [ ] Digest sent only once per week per user

---

## Scenario 6: Validation: Invalid Webhook/Email

**Objective**: Verify system handles invalid credentials gracefully

**Steps**:

1. Try to add alert channel with:
   - **Invalid URL**: `http://not-https.example.com` (not HTTPS)
   - **Expected**: Form error "Webhook URL must be HTTPS"
2. Try with:
   - **Invalid Email**: `not-an-email`
   - **Expected**: Form error "Please enter a valid email address"
3. Try with valid-looking but non-existent webhook URL
4. Click "Test"
5. **Expected**: Error message: "Failed to send test: Connection refused" or similar, with retry guidance

**Pass Criteria**:
- [ ] Client-side validation prevents invalid format submissions
- [ ] Server-side validation catches edge cases
- [ ] Error messages are user-friendly and actionable

---

## Scenario 7: Validation: Permission & Isolation

**Objective**: Verify alerts from other users don't leak to your channels

**Setup**:
- Two user accounts (User A, User B)
- User A has Slack webhook configured
- User B has different Slack webhook configured
- Monitors in User A's account

**Steps**:

1. Log in as User A
2. Trigger down event on User A's monitor
3. Check User A's Slack channel: **Expected** message arrives
4. Check User B's Slack channel: **Expected** no message (User A's alerts should not appear)
5. Verify via AlertLog API: User A can only see their own channel logs

**Pass Criteria**:
- [ ] Alerts sent only to configured user's channels
- [ ] No cross-user alert leakage

---

## Scenario 8: Channel Management

**Objective**: Verify create/update/delete/disable operations

**Steps**:

1. Add Slack channel
2. Update webhook URL (change to different Slack channel)
3. **Expected**: New down events go to updated webhook
4. Disable channel (toggle "Active")
5. Trigger down event
6. **Expected**: Alert NOT sent (channel inactive)
7. Re-enable channel
8. Trigger down event
9. **Expected**: Alert sent again
10. Delete channel
11. **Expected**: Channel removed from list, future alerts not sent

**Pass Criteria**:
- [ ] Update changes destination
- [ ] Disable prevents alert sends
- [ ] Delete removes channel permanently

---

## Validation Checklist

Use this checklist to sign off on the feature:

- [ ] Scenario 1 (Slack) passes
- [ ] Scenario 2 (Discord) passes
- [ ] Scenario 3 (Email) passes
- [ ] Scenario 4 (Deduplication) passes
- [ ] Scenario 5 (Weekly Digest) passes
- [ ] Scenario 6 (Invalid Input) passes
- [ ] Scenario 7 (Isolation) passes
- [ ] Scenario 8 (Management) passes
- [ ] E2E tests pass: `npm run test:e2e -w @saas-pulse/api`
- [ ] Linting passes: `npm run lint -w @saas-pulse/api` and `-w @saas-pulse/web`
- [ ] No TypeScript errors
- [ ] Manual testing across Chrome, Firefox, Safari
- [ ] AlertLog table has correct data and no orphaned records
- [ ] Weekly digest runs reliably on schedule for 2 weeks

**Status**: ✅ Ready for production when all items checked
