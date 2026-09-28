# Feature Specification: Account Authentication & Data Isolation

**Feature Branch**: `002-jwt-auth`

**Created**: 2026-09-27

**Status**: Draft

**Input**: User description: "JWT authentication for the SaaS Pulse API: user registration and login with email + password (bcrypt-hashed), JWT access tokens, a guard protecting all non-auth routes, a current-user accessor for handlers, and multi-tenant scoping so users can only access their own monitors and checks. Shared request/response types in packages/shared. Minimal web login/register pages are out of scope for this feature."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create an account (Priority: P1)

A new user signs up with an email address and a password so they can start using SaaS Pulse. On success, they are immediately signed in and receive a credential they can use for further requests.

**Why this priority**: Every other capability (monitors, checks, dashboards, alerts) belongs to a user. Nothing can be owned or protected until accounts exist.

**Independent Test**: Register with a new email and a valid password, then confirm the response contains a usable access credential and the account's public profile (with no password).

**Acceptance Scenarios**:

1. **Given** no account exists for `ana@example.com`, **When** a user registers with that email and a valid password, **Then** the account is created and the response contains an access credential and the user's id, email and name. The password or its stored form never appears in the response.
2. **Given** an account already exists for `ana@example.com`, **When** someone registers with `Ana@Example.com`, **Then** registration is rejected with a "email already in use" conflict error and no second account is created.
3. **Given** a registration request with an invalid email or a password shorter than 8 characters, **When** it is submitted, **Then** it is rejected with a validation error naming the invalid fields.

---

### User Story 2 - Sign in (Priority: P1)

A returning user signs in with their email and password and receives an access credential.

**Why this priority**: Without sign-in, a user can reach their account only once, at registration.

**Independent Test**: Register an account, then sign in with the same credentials and confirm a new access credential is returned.

**Acceptance Scenarios**:

1. **Given** an existing account, **When** the user signs in with the correct email (any letter case) and password, **Then** they receive an access credential and their public profile.
2. **Given** an existing account, **When** the user signs in with a wrong password, **Then** the request is rejected as unauthorized with the generic message "Invalid email or password".
3. **Given** no account exists for an email, **When** someone tries to sign in with it, **Then** they get exactly the same response as for a wrong password, so it is impossible to tell whether an account exists.

---

### User Story 3 - Access protected resources as yourself (Priority: P1)

A signed-in user presents their access credential on each request. The system identifies who they are, lets them reach protected functionality, and refuses anonymous or invalid requests.

**Why this priority**: This is what makes the account meaningful. It is also the mechanism every later feature (monitors, checks) relies on to know which user is acting.

**Independent Test**: Call the "current user" endpoint with a valid credential and get your own profile back; call it with no credential, a tampered credential or an expired credential and get "unauthorized" each time.

**Acceptance Scenarios**:

1. **Given** a valid access credential, **When** the user requests their own profile, **Then** they receive their id, email and name.
2. **Given** no credential, a malformed credential, a credential with an altered signature, or an expired credential, **When** any protected endpoint is called, **Then** the request is rejected as unauthorized and no protected data is returned.
3. **Given** a valid credential for a user whose account has since been deleted, **When** a protected endpoint is called, **Then** the request is rejected as unauthorized.
4. **Given** the system is running, **When** anyone calls the public endpoints (the root endpoint, the health check, register, sign-in) without a credential, **Then** they work normally.

---

### User Story 4 - Users only ever see their own data (Priority: P2)

Two different users each have their own monitors and check history. Each one can only see, change or delete their own. Another user's data behaves as if it does not exist.

**Why this priority**: This is essential for a multi-tenant SaaS, but there is nothing to isolate until the monitors feature exists. This feature establishes the rule and the mechanism; the monitors feature applies it and proves it end-to-end.

**Independent Test**: Once monitor endpoints exist, create a monitor as user A, then as user B try to read, update and delete it by id. Each attempt returns "not found". Listing monitors as user B does not include it.

**Acceptance Scenarios**:

1. **Given** user A owns monitor M, **When** user B requests M by its id, **Then** the response is "not found" (not "forbidden"), so the existence of M is not revealed.
2. **Given** user A owns monitors and user B owns none, **When** user B lists monitors, **Then** the list is empty.
3. **Given** any user-owned resource is created, **When** it is saved, **Then** its owner is always the signed-in user, never a value taken from the request body.

---

### Edge Cases

- **Two registrations for the same email at the same moment:** exactly one succeeds and the other gets the "email already in use" conflict.
- **Email with surrounding whitespace or mixed case:** the email is trimmed and lower-cased before it is stored or compared.
- **Very long password:** passwords longer than 72 bytes are rejected with a validation error, rather than having the part beyond 72 bytes silently ignored.
- **Credential sent in the wrong format:** a credential missing the `Bearer` prefix is treated as no credential.
- **Unknown fields in the request body:** they are rejected with a validation error rather than silently stored. For example, a registration request that tries to set its own id is rejected.
- **Signing secret missing from configuration:** the service refuses to start rather than running with a default or empty secret.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow a visitor to create an account with an email, a password and an optional display name.
- **FR-002**: The system MUST treat emails case-insensitively and ignore surrounding whitespace; at most one account may exist per email.
- **FR-003**: The system MUST require passwords of at least 8 characters and at most 72 bytes.
- **FR-004**: The system MUST store passwords only in a salted, deliberately slow one-way hashed form, and MUST NOT return the password or its hash in any response or log.
- **FR-005**: The system MUST let an existing user sign in with email and password, and issue a signed, time-limited access credential on successful registration or sign-in.
- **FR-006**: The system MUST respond to every failed sign-in with the same generic error, whether the email is unknown or the password is wrong.
- **FR-007**: Access credentials MUST expire. The default lifetime is 1 day, configurable per environment.
- **FR-008**: All endpoints MUST require a valid access credential by default. Only explicitly marked public endpoints (root, health, register, sign-in) are exempt, so that a new endpoint is protected unless someone deliberately opts it out.
- **FR-009**: The system MUST provide an endpoint that returns the signed-in user's own profile (id, email, name).
- **FR-010**: Request handlers MUST be able to obtain the signed-in user's identity directly, without parsing the credential themselves.
- **FR-011**: The system MUST reject requests whose credential is missing, malformed, wrongly signed, expired, or belongs to a user who no longer exists.
- **FR-012**: Every read, update or delete of user-owned data (monitors, checks) MUST be limited to the signed-in user's own records. A record owned by another user MUST be reported as not found.
- **FR-013**: The owner of newly created user-owned data MUST be set from the signed-in identity, never from the request body.
- **FR-014**: The request and response formats for registration, sign-in and the profile MUST be defined once and shared by the API and the web app.
- **FR-015**: Invalid input MUST be rejected with a validation error that names the invalid fields, and request fields that are not allowed MUST be rejected.

### Key Entities

- **User**: an account holder. It has a unique email (stored normalized), an optional display name, a hashed password, and creation/update timestamps. It owns zero or more Monitors.
- **Access credential**: a signed, expiring token issued at registration or sign-in. It identifies the user and is presented on each protected request. The server does not store it.
- **Monitor / Check** (existing): user-owned data. A Monitor belongs to exactly one User, and each Check belongs to a Monitor, so it is owned by that Monitor's User.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new user can create an account and make their first authenticated request in under 1 minute using only the API documentation.
- **SC-002**: 100% of endpoints other than the four explicitly public ones reject requests without a valid credential. This is verified by an automated test that calls every protected endpoint without one.
- **SC-003**: In automated tests with two users, 0 attempts by one user to read, change or delete the other's data succeed.
- **SC-004**: A failed sign-in response is identical whether the email exists or not, so an observer cannot tell whether an account exists.
- **SC-005**: No response body or application log produced during registration or sign-in contains a password or password hash.
- **SC-006**: Registration and sign-in each complete in under 1 second for a single user under normal local conditions.

## Assumptions

- **Stateless credentials:** there is no server-side session and no refresh token in this feature. When a credential expires, the user signs in again. Refresh tokens and server-side revocation are future work.
- **No logout endpoint:** the client signs out by discarding its credential. Server-side logout would need revocation, which is out of scope.
- **Out of scope:** password reset, email verification, OAuth/social login, and rate limiting or lockout after repeated failed sign-ins. Rate limiting is noted as a follow-up before any public deployment.
- **Web pages out of scope:** login and register pages in the web app are not part of this feature, as the request states.
- **Isolation is proven later:** monitor and check endpoints don't exist yet. This feature delivers the ownership rule and the mechanism to identify the current user; the Monitors CRUD feature must apply FR-012 and FR-013 and include the two-user isolation tests in SC-003.
- **Data model:** the `User` model already exists in the current schema with the needed fields (email unique, name optional, password hash, timestamps), so no migration should be needed. The constitution's Principle IV still describes the old commented-out models and is out of date.
- **Signing secret:** the credential signing secret comes from environment configuration and is never committed. Local development uses an untracked env file.
