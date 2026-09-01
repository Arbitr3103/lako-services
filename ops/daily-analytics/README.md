# Daily analytics report

Production source for the daily Cloudflare and database summary sent to the
private administrator Telegram chat.

## Behavior

- Preserves the existing daily traffic and database counters.
- Reports `OK`, `ATTENTION`, or `CRITICAL` for `lako.services`.
- Treats Cloudflare threat totals as informational security signals.
- Deduplicates mitigated scanner fingerprints for seven days.
- Uses `CRITICAL` only for HTTP 5xx responses, Worker runtime errors, or
  unexpected `2xx` POST requests to unknown routes.
- Treats unknown-route `3xx` POST responses as `ATTENTION`, because the site
  can legitimately issue redirects before an application route runs. The
  report includes up to five `path · status · count` aggregates for unexpected
  `2xx` requests and redirects.
- Allows successful POSTs on `lako.services` only for `/api/contact`,
  `/api/register-business`, and Cloudflare's `/cdn-cgi/` endpoints. e-Faktura
  API traffic belongs to `bot.lako.services`; a successful `/api/efaktura/*`
  POST on the main site is therefore `CRITICAL`.
- Uses `ATTENTION` when a new high-volume blocked scanner appears or a required
  analytics source cannot be checked.
- Commits deduplication state only after Telegram confirms delivery.

## Production paths

- Wrapper: `/usr/local/bin/daily-analytics.sh`
- Reporter: `/usr/local/lib/lako-analytics/report.mjs`
- State: `/var/lib/lako-analytics/state.json` (`0600`)
- Environment: `/root/.env`
- Log: `/var/log/monitoring/analytics.log`

Required environment variable names:

```text
CF_API_TOKEN
CF_ACCOUNT_ID
MONITOR_BOT_TOKEN
MONITOR_CHAT_ID
LAKO_ZONE
ECHAIN_ZONE
ECHAIN_DB_PASSWORD
LAKO_BOT_DB_PASSWORD
```

Optional: `LAKO_WORKER_NAME` defaults to `lako-services`.

Do not store values in this repository. The production wrapper and environment
must remain root-only. Keep the existing cron schedule unchanged.

## Verification

```bash
npm run test:analytics
bash -n ops/daily-analytics/daily-analytics.sh
```

Production dry-run does not send Telegram and does not mutate state:

```bash
sudo /usr/local/bin/daily-analytics.sh --dry-run
```

`--send-test` sends one report and commits its deduplication state only after
Telegram returns `ok: true`.

`install-on-aeza.sh` must run as root on Aeza. It creates a root-only backup,
migrates the legacy inline database credentials and Telegram chat ID into
`/root/.env`, and installs the wrapper and reporter without changing cron.
