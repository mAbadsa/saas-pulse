# Feature Specification: Continuous Integration Pipeline

**Feature Branch**: `006-ci-pipeline`

**Created**: 2026-09-28

**Status**: Draft

**Input**: User description: "CI with GitHub Actions: on every push and pull request, lint the API and web app, run unit tests, run e2e tests against real Postgres + Redis, and build everything."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Every change is checked automatically (Priority: P1)

A contributor pushes a branch or opens a pull request, and within minutes sees a pass or fail result covering linting, formatting, unit tests, end-to-end tests and a full build, without running anything locally.

**Why this priority**: Work is now merged through pull requests. Without an automatic check, a broken build or failing test can reach the main branch unnoticed, as the earlier fresh-clone build failure and the hung test run showed.

**Independent Test**: Push a branch with a deliberate lint error and see the check fail on it; fix it, push again, and see the check pass.

**Acceptance Scenarios**:

1. **Given** a push to any branch, **When** it arrives on the repository host, **Then** the pipeline runs and reports pass or fail on that commit.
2. **Given** a pull request, **When** it is opened or updated, **Then** the pipeline result is shown on the pull request.
3. **Given** code that violates a lint rule, or isn't formatted to the project's standard, **When** the pipeline runs, **Then** it fails at the lint step and names the file.
4. **Given** a failing unit test or end-to-end test, **When** the pipeline runs, **Then** it fails and the log shows which test failed.
5. **Given** code that doesn't compile or build, **When** the pipeline runs, **Then** it fails at the build step.
6. **Given** a clean change, **When** the pipeline runs, **Then** every step passes.

---

### User Story 2 - The check matches a fresh checkout (Priority: P2)

The pipeline starts from a completely clean checkout with no leftover build output, local environment files or pre-existing database, so "passes in CI" means "works for someone who just cloned the repo".

**Why this priority**: Several past problems were invisible locally because of leftover files: the missing generated shared types, and a stale build cache.

**Independent Test**: The pipeline's own log shows dependencies installed from the lockfile, the database schema created from the committed migrations, and no reliance on a local `.env`.

**Acceptance Scenarios**:

1. **Given** a clean checkout, **When** the pipeline runs, **Then** dependencies are installed exactly as pinned in the lockfile.
2. **Given** an empty database, **When** the pipeline runs, **Then** the schema is created only from the committed migrations.
3. **Given** the signing secret needed by the API, **When** the pipeline runs, **Then** it is a throwaway value generated for that run and never stored in the repository.

---

### Edge Cases

- **A superseded run is still in progress:** if a branch receives a new push while its previous run is still going, the older run is cancelled, so results reflect the latest commit and resources aren't wasted.
- **Database or cache starting slowly:** the pipeline waits until they're ready before running tests, instead of failing randomly.
- **A test hangs:** the whole run is capped at a fixed time limit (15 minutes), so a hang can't block results indefinitely.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The pipeline MUST run on every push to any branch and on every pull request.
- **FR-002**: The pipeline MUST install dependencies from the lockfile only.
- **FR-003**: The pipeline MUST lint the API and the web app, and MUST fail if linting would change any file (formatting drift).
- **FR-004**: The pipeline MUST run the API unit tests and the API end-to-end tests. The end-to-end tests run against real PostgreSQL 15 and Redis instances whose schema comes from the committed migrations.
- **FR-005**: The pipeline MUST build the shared package, the API and the web app.
- **FR-006**: Any failing step MUST fail the whole run, with a log that identifies the failing step.
- **FR-007**: The API signing secret used in the pipeline MUST be generated per run and never committed.
- **FR-008**: Runs superseded by a newer push to the same branch or pull request MUST be cancelled, and every run MUST be capped at 15 minutes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every push and pull request gets a pass or fail result within 10 minutes under normal conditions.
- **SC-002**: A deliberately introduced lint error, failing test or build error each causes the run to fail (verified once for lint when the pipeline is introduced).
- **SC-003**: The current main line of work passes the pipeline with no changes to application code.
- **SC-004**: No secret value exists in the repository to make the pipeline pass.

## Assumptions

- **The repository is hosted on GitHub,** so GitHub Actions is the CI provider.
- **Checks only, no deployment:** building Docker images and deploying are separate roadmap items (roadmap phase 5).
- **Protecting the main branch** (requiring this check to pass before merging) is a repository setting the owner turns on after the first green run. It can't be configured from code in this repo.
- **The web app has no tests yet,** so its checks are lint and build, the same gates the constitution sets.
