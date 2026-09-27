# Quickstart: Validate Monitors Management

## Prerequisites

`npm run db:up`, `apps/api/.env` containing `JWT_SECRET`, and `npm run dev:api` running.

## Automated checks

```bash
npm run lint -w @saas-pulse/api
npm run test -w @saas-pulse/api
npm run test:e2e -w @saas-pulse/api   # includes monitors.e2e-spec.ts (two-user isolation, cascade delete)
```

## Manual walkthrough

Shapes are in [contracts/monitors-api.md](./contracts/monitors-api.md).

```bash
API=http://localhost:3000; J='Content-Type: application/json'
login() { curl -s -X POST $API/auth/register -H "$J" -d "{\"email\":\"$1\",\"password\":\"s3cret-pass\"}" | jq -r .accessToken; }
A=$(login a-$RANDOM@example.com); B=$(login b-$RANDOM@example.com)

# 1. Create → 201, status PENDING, isActive true, intervalSeconds 60
ID=$(curl -s -X POST $API/monitors -H "$J" -H "Authorization: Bearer $A" \
  -d '{"name":"Example","url":"https://example.com"}' | tee /dev/stderr | jq -r .id)

# 2. Invalid URL / interval / extra field → 400
curl -s -X POST $API/monitors -H "$J" -H "Authorization: Bearer $A" -d '{"name":"x","url":"ftp://x.com"}'
curl -s -X POST $API/monitors -H "$J" -H "Authorization: Bearer $A" -d '{"name":"x","url":"https://x.com","intervalSeconds":10}'
curl -s -X POST $API/monitors -H "$J" -H "Authorization: Bearer $A" -d '{"name":"x","url":"https://x.com","userId":"someone"}'

# 3. List (A sees 1, B sees 0)
curl -s $API/monitors -H "Authorization: Bearer $A" | jq length
curl -s $API/monitors -H "Authorization: Bearer $B" | jq length

# 4. Pause → isActive false; B trying to pause A's monitor → 404
curl -s -X PATCH $API/monitors/$ID -H "$J" -H "Authorization: Bearer $A" -d '{"isActive":false}'
curl -s -X PATCH $API/monitors/$ID -H "$J" -H "Authorization: Bearer $B" -d '{"isActive":false}'

# 5. Delete → 204, then 404
curl -s -o /dev/null -w '%{http_code}\n' -X DELETE $API/monitors/$ID -H "Authorization: Bearer $A"
curl -s -o /dev/null -w '%{http_code}\n' $API/monitors/$ID -H "Authorization: Bearer $A"
```

## Expected outcome

Every step returns the status noted in its comment, and no response contains `userId`.
