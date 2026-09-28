# Research: Account Authentication & Data Isolation

## 1. Token verification: plain guard vs Passport

- **Decision:** a custom `AuthGuard` that uses `JwtService.verifyAsync` from `@nestjs/jwt`.
- **Rationale:** there is one strategy (a Bearer JWT), and a plain guard is about 30 lines. Passport would add 3 packages (`@nestjs/passport`, `passport`, `passport-jwt`) and a strategy class, and its value is supporting many strategies, which this app doesn't need. The NestJS docs show this plain-guard approach as their primary authentication example.
- **Alternatives considered:** `@nestjs/passport` + `passport-jwt`. Worth revisiting if OAuth or social login is added.

## 2. Protected by default

- **Decision:** register `AuthGuard` as `APP_GUARD`. It skips handlers or controllers marked `@Public()`, which it reads through `Reflector.getAllAndOverride`.
- **Rationale:** FR-008 says a newly added endpoint must be protected unless someone deliberately opts it out. Opt-in `@UseGuards()` fails open when someone forgets it.
- **Alternatives considered:** `@UseGuards(AuthGuard)` on each controller. Rejected because a forgotten guard would leave an endpoint open.

## 3. Password hashing library

- **Decision:** `bcryptjs` v3, cost factor 10.
- **Rationale:**
  - The request names bcrypt.
  - `bcryptjs` produces the same hash format as native `bcrypt` but has no native build step (no node-gyp or prebuilt-binary problems in Docker or CI).
  - v3 ships its own TypeScript types.
  - Cost 10 takes about 60–80 ms, well under the 1 s target in SC-006.
- **Alternatives considered:**
  - Native `bcrypt`: faster, but needs native compilation.
  - `argon2`: stronger, but also native, and not what the request names.
  - `crypto.scrypt` from the Node standard library: would add no dependency, but the request asks for bcrypt.

## 4. bcrypt's 72-byte limit

- **Decision:** reject passwords longer than 72 **bytes** (UTF-8) with a validation error. Minimum length is 8 characters.
- **Rationale:** bcrypt silently ignores everything after byte 72. Rejecting longer input is more honest than hashing only part of it. class-validator's `MaxLength` counts characters, not bytes, so the check is `Buffer.byteLength(password, 'utf8') > 72`, done in a small custom validator on the DTO.

## 5. Uniform failed-login response (SC-004)

- **Decision:** unknown email and wrong password both return `401 { message: 'Invalid email or password' }`. When the email is unknown, the service still runs `bcrypt.compare` against a fixed dummy hash, so the response takes about as long either way.
- **Rationale:** without the dummy compare, an unknown email returns in about 1 ms while a known one takes about 70 ms. That timing difference would reveal which emails have accounts.

## 6. Email normalization and duplicate registration

- **Decision:** the DTO uses `@Transform` to trim and lower-case the email before validation. Uniqueness is enforced by the existing `@unique` constraint on `User.email`. The service catches Prisma error `P2002` and turns it into `409 Conflict` ("Email already in use").
- **Rationale:** a "find, then create" check can race when two registrations arrive at once. Relying on the database constraint makes the edge case "two registrations at the same moment" correct: exactly one succeeds.

## 7. Token contents and configuration

- **Decision:**
  - Payload `{ sub: user.id }`, signed with HS256.
  - `JWT_SECRET` read with `ConfigService.getOrThrow`, so the app refuses to start without it.
  - `JWT_EXPIRES_IN` defaults to `'1d'`.
- **Rationale:** a minimal payload means the profile is always read fresh from the database, and no email is embedded in a token that could outlive an email change. `getOrThrow` covers the "missing signing secret" edge case.

## 8. Validation pipe placement

- **Decision:** register `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })` as `APP_PIPE` in `AppModule`, not in `main.ts`.
- **Rationale:** e2e tests build the app from `AppModule` and never run `main.ts`. Registering the pipe through the module means tests see exactly the same validation as production. `forbidNonWhitelisted` covers FR-015 (reject unexpected fields).

## 9. How multi-tenant scoping works

- **Decision:** no generic "tenant" layer. Each service method that touches owned data takes a `userId` argument (from `@CurrentUser()`) and puts it in the Prisma `where` clause, for example `findFirst({ where: { id, userId } })`, then throws `NotFoundException` if the result is null. Create calls set `userId` from `@CurrentUser()`, never from the DTO. The DTO whitelist rejects a `userId` sent in the body.
- **Rationale:** an explicit `where` filter is easy to review and test. Prisma client extensions or row-level security would add machinery before there is even one owned-data endpoint (Principle V).
- **Upgrade path:** Postgres row-level security, if the number of owned-data queries grows enough that forgetting the filter becomes a real risk.
