// E2E suites drive PingService.runCycle() explicitly; never run the background loop.
// Suites run serially (maxWorkers: 1 in jest-e2e.json) because they share one database
// and runCycle() checks every due monitor, not just the calling suite's.
process.env.PING_ENABLED = 'false';
// Never reach the real Telegram from tests, even if apps/api/.env has a bot token.
// (An empty value in process.env takes precedence over .env; the alerts suite sets a fake one.)
process.env.TELEGRAM_BOT_TOKEN = '';
