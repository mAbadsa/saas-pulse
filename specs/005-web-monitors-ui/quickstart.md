# Quickstart: Validate the Web App

## Gates

```bash
npm run lint -w @saas-pulse/web
npm run build            # shared → api → web (tsc -b + vite build)
```

## Manual walkthrough

Run `npm run db:up`, `npm run dev:api` and `npm run dev:web`, then open http://localhost:5173.

1. Signed out, `/` redirects to `/login`. Choose "Create account", register a new email, and land on the empty state.
2. "Add monitor" with `https://example.com` → it appears as **Pending**, then turns **Up** within about 25 s with no reload.
3. Add `https://example.com/definitely-missing-page` → **Down**. Add `ftp://x.com` → the server error is shown in the form and the form stays open.
4. Edit the first monitor's name, which updates in the list. Change its URL, and it goes back to **Pending**.
5. Pause it → **Paused**; resume it → its status is back.
6. Delete it → a confirmation mentioning history → it disappears.
7. Reload the page and you're still signed in. Sign out → `/login`.
8. Expired session: set `localStorage['saas-pulse.session']` to a token with an invalid signature and wait for the next refresh → back at `/login` with the "session expired" message.
9. Keyboard only: Tab to "Add monitor", press Enter, fill in the form, submit with Enter, and Escape closes the dialog.
10. In DevTools, at a 375 px width, there's no horizontal scroll and every action is reachable.
