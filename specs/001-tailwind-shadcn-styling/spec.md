# Feature Specification: Tailwind + shadcn/ui Styling System

**Feature Branch**: `001-tailwind-shadcn-styling`

**Created**: 2026-09-27

**Status**: Draft

**Input**: User description: "Adopt Tailwind CSS v4 and shadcn/ui as the styling system for apps/web, replacing the current hand-written App.css/index.css. Prove it out by restyling the existing health-check display (which currently just shows the raw /health JSON response as plain text) using a couple of shadcn primitives (e.g. a Card showing overall status, a Badge or colored text per dependency (db/redis), a Button to manually re-check). No new pages or routes — same single-page app, same data (HealthCheckResponse from @saas-pulse/shared), just restyled with Tailwind utilities + shadcn components instead of hand-written CSS."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Readable system status at a glance (Priority: P1)

A visitor opens the web app and needs to immediately understand whether the
system is healthy, without reading raw JSON.

**Why this priority**: This is the only screen the app currently has — it's
the entire user-facing surface today, so it's the only place the new styling
system can prove itself.

**Independent Test**: Load the app with the API reachable and healthy; the
page shows an overall "healthy" state and a per-dependency (database, Redis)
status, each visually distinct (e.g. by color), with no raw JSON visible.

**Acceptance Scenarios**:

1. **Given** the API and its dependencies (database, Redis) are all up,
   **When** the page loads, **Then** the visitor sees an overall "healthy"
   indicator and each dependency shown individually as healthy.
2. **Given** one dependency (e.g. Redis) is down while the others are up,
   **When** the page loads, **Then** the overall indicator reflects the
   degraded state and the affected dependency is visually distinguishable
   from the healthy ones.
3. **Given** the page has already loaded a status, **When** the visitor
   triggers a manual re-check, **Then** the displayed status refreshes to
   the latest result without a full page reload.

### User Story 2 - Consistent, maintainable visual foundation (Priority: P2)

A developer extending the web app in the future needs a predictable way to
style new UI without hand-rolling CSS files per component.

**Why this priority**: The app has exactly one screen today; this story is
about the foundation paying off on the *next* screen, not this one.

**Independent Test**: Inspect the app after the change — there is a single
styling approach (utility classes + a shared component set) rather than a mix
of bespoke per-component stylesheets, and adding one more small UI element
follows the same pattern already in use.

**Acceptance Scenarios**:

1. **Given** the styling system is adopted, **When** a developer inspects
   `apps/web`, **Then** there is no remaining hand-written CSS duplicating
   what the styling system already provides.

### Edge Cases

- What happens when the API is completely unreachable (network error, not
  just a degraded dependency)? The page MUST still render a clear "unable to
  reach the system" state rather than a blank screen or unstyled error.
- What happens while a manual re-check is in flight? The previous status
  MUST remain visible (not replaced by a blank/loading flash) until the new
  result arrives.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The web app MUST present the health status using the shared
  styling system's visual components (not raw JSON, not the previous
  hand-written stylesheet).
- **FR-002**: The web app MUST show the overall system status and each
  individual dependency's status (currently: database, Redis) as visually
  distinct elements.
- **FR-003**: The web app MUST use distinguishable visual treatment (e.g.
  color) to differentiate healthy, degraded, and unreachable states, for
  both the overall status and each dependency.
- **FR-004**: The web app MUST let the visitor manually trigger a re-check of
  the health status from the same screen.
- **FR-005**: The web app MUST continue to source health data from the
  existing `/health` endpoint and the existing shared `HealthCheckResponse`
  contract — this feature changes presentation only, not the data contract.
- **FR-006**: The project MUST NOT retain hand-written CSS rules that the
  adopted styling system's utilities/components already cover.

### Key Entities

- **Health Check Response**: the existing overall status plus a per-dependency
  breakdown (database, Redis), already defined in `@saas-pulse/shared`. This
  feature changes only how it is displayed, not its shape.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time visitor can tell whether the system is healthy or
  degraded within 2 seconds of the page loading, without reading raw data.
- **SC-002**: Every dependency reported by the health check is individually
  visible on screen, with zero dependencies hidden or merged into a generic
  summary.
- **SC-003**: A visitor can get an updated status without leaving or
  reloading the page.
- **SC-004**: Zero hand-written, component-specific CSS files remain in
  `apps/web` for surfaces this feature touches.

## Assumptions

- Only the existing single-page health display is in scope; no new routes or
  pages are introduced by this feature.
- The visual design language itself (exact colors, spacing, typography scale)
  is an implementation decision made during planning, not dictated here —
  this spec requires *that* status is visually differentiated, not a specific
  palette.
- Manual re-check re-uses the same `/health` call the page already makes on
  load; no new backend endpoint is required.
