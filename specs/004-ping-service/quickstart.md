# Quickstart: Validate the Ping Service

## Automated checks

```bash
npm run db:up
npm run lint -w @saas-pulse/api
npm run test -w @saas-pulse/api       # blocked-addresses unit tests
npm run test:e2e -w @saas-pulse/api   # ping.e2e-spec.ts: outcomes, due-ness, paused, SSRF, URL-change race
```

## Manual walkthrough (dev API with the loop running)

```bash
API=http://localhost:3000; J='Content-Type: application/json'
T=$(curl -s -X POST $API/auth/register -H "$J" -d "{\"email\":\"p-$RANDOM@example.com\",\"password\":\"s3cret-pass\"}" | jq -r .accessToken)
H="Authorization: Bearer $T"

curl -s -X POST $API/monitors -H "$J" -H "$H" -d '{"name":"up","url":"https://example.com"}'
curl -s -X POST $API/monitors -H "$J" -H "$H" -d '{"name":"404","url":"https://example.com/definitely-missing-page"}'
curl -s -X POST $API/monitors -H "$J" -H "$H" -d '{"name":"ssrf","url":"http://169.254.169.254/latest/meta-data"}'

sleep 15
curl -s $API/monitors -H "$H" | jq '.[] | {name, status, lastCheckedAt}'
```

## Expected outcome

- `up` → `UP`
- `404` → `DOWN`
- `ssrf` → `DOWN`, with its check error `Blocked address 169.254.169.254` (inspect it with `SELECT * FROM "Check"` until there's an endpoint)
- every `lastCheckedAt` is set
