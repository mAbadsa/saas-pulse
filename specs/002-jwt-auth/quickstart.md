# Quickstart: Validate Authentication

## Prerequisites

```bash
npm run db:up
# apps/api/.env must contain JWT_SECRET (see .env.example), e.g.:
#   JWT_SECRET=<output of: openssl rand -hex 32>
#   JWT_EXPIRES_IN=1d
npm run dev:api
```

The API must refuse to start if `JWT_SECRET` is missing. Remove it briefly to check.

## Automated checks

```bash
npm run test -w @saas-pulse/api       # unit: AuthService
npm run test:e2e -w @saas-pulse/api   # e2e: auth flows + public routes (needs db:up)
npm run lint -w @saas-pulse/api
```

## Manual walkthrough

Shapes are in [contracts/auth-api.md](./contracts/auth-api.md).

```bash
API=http://localhost:3000

# 1. Register → 201 with accessToken + user (no password field)
curl -s -X POST $API/auth/register -H 'Content-Type: application/json' \
  -d '{"email":" Ana@Example.com ","password":"s3cret-pass","name":"Ana"}'

# 2. Same email in a different case → 409
curl -s -X POST $API/auth/register -H 'Content-Type: application/json' \
  -d '{"email":"ana@example.com","password":"s3cret-pass"}'

# 3. Login → 200; save the token
TOKEN=$(curl -s -X POST $API/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"ana@example.com","password":"s3cret-pass"}' | jq -r .accessToken)

# 4. Wrong password and unknown email → the same 401 body
curl -s -X POST $API/auth/login -H 'Content-Type: application/json' -d '{"email":"ana@example.com","password":"wrong-pass"}'
curl -s -X POST $API/auth/login -H 'Content-Type: application/json' -d '{"email":"nobody@example.com","password":"wrong-pass"}'

# 5. /auth/me with a token → 200 profile; without one or with a tampered one → 401
curl -s $API/auth/me -H "Authorization: Bearer $TOKEN"
curl -s $API/auth/me
curl -s $API/auth/me -H "Authorization: Bearer ${TOKEN}x"

# 6. Public routes still work without a token → 200
curl -s $API/health
```

## Expected outcome

Every step returns the status noted in its comment, and no response contains `password`.
