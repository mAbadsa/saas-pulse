// E2E suites drive PingService.runCycle() explicitly; never run the background loop.
// Suites run serially (maxWorkers: 1 in jest-e2e.json) because they share one database
// and runCycle() checks every due monitor, not just the calling suite's.
process.env.PING_ENABLED = 'false';
