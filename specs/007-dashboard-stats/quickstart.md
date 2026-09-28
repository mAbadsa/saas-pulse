# Quickstart: Validate Dashboard Stats

## Automated

```bash
npm run db:up
npm run lint -w @saas-pulse/api && npm run lint -w @saas-pulse/web
npm run test -w @saas-pulse/api
npm run test:e2e -w @saas-pulse/api   # includes stats.e2e-spec.ts (exact figures, gaps, isolation, retention, 20k-check timing)
npm run build
```

## Manual (browser)

1. **List:** with the dev API and web app running, monitors that have been checked show "NN.N% · NNN ms · 24h"; a brand-new one shows "No data yet".
2. **Detail:** click a monitor name to reach `/monitors/<id>`. You should see stat tiles, a blue latency chart and recent checks. Hovering the chart shows a vertical cursor and a tooltip with time, average latency, uptime and check count.
3. **Range:** switch to "7 days". The URL becomes `?range=7d`, the chart has 6-hour slots, and a reload keeps 7 days.
4. **Failures:** pause a monitor, or point it at a failing URL. Recent checks show the error text, and the chart shows gaps for slots with no data.
5. **Dark mode:** with the OS in dark mode, the chart line is lighter blue and still clearly visible.
6. **Not found:** opening `/monitors/not-a-real-id` shows "Monitor not found" with a link back.
