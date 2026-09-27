# Contract: Ping Service Configuration & Outbound Behaviour

The feature adds no HTTP endpoints. These are its external interfaces:

## Environment variables (API)

| Variable | Default | Effect |
|----------|---------|--------|
| `PING_ENABLED` | `true` | `false` means the periodic loop never starts (tests, one-off scripts) |
| `PING_ALLOW_PRIVATE` | `false` | `true` allows loopback/private targets. **For local development only; never enable it in production.** |
| `PING_TIMEOUT_MS` | `10000` | Time limit for each check |

## Outbound request

- `GET <monitor.url>` with the header `User-Agent: SaaSPulse/1.0 (+uptime monitor)`
- redirects aren't followed, and the body is discarded
- the connection is refused if any resolved address is non-public (see research §4 for the ranges)

## Error strings stored in `Check.error`

| Cause | Example |
|-------|---------|
| Timeout | `Timed out after 10000 ms` |
| Blocked by the SSRF guard | `Blocked address 127.0.0.1` |
| DNS failure | `getaddrinfo ENOTFOUND nope.invalid` |
| Connection refused | `connect ECONNREFUSED 203.0.113.5:443` |
| TLS failure | e.g. `certificate has expired` |
