SLUG: monitoring-uptime-for-free
TITLE: Monitoring Uptime for Free: Health Checks, Timers, and Honest Alerts
EXCERPT: Your site being down is fine as long as you are the first to know — a health endpoint, an external checker, and a watchdog timer cover almost every small-project need.
TAGS: monitoring, uptime, operations, systemd

## The Only Question Monitoring Answers First

Not dashboards, not metrics oceans — **is it up right now, and did I find out before a user did?** Everything else is a luxury; that one answer is the product.

## Layer 1: A Health Endpoint Your Own Code Owns

```js
app.get('/health', async (req, res) => {
  const checks = {
    ok: true,
    uptime: Math.round(process.uptime()),
    search: await searchPing(),   // can we reach the search index?
  };
  res.status(checks.ok ? 200 : 503).json(checks);
});
```

Rules that make it useful:

- **Check dependencies, not just the process.** A server that answers `200` while its search index is unreachable is lying.
- **Return `503` when degraded** — monitoring tools trust status codes, not JSON prose.
- **Keep it fast** (<100ms) — it will be called every minute from three places.

## Layer 2: Ask From Outside

A local `curl` proves the process runs; it does not prove the internet reaches you. External checks catch DNS failures, certificate expiry, and edge-provider outages:

- **UptimeRobot / BetterStack / Healthchecks.io** — free tiers run checks every 1–5 minutes from multiple regions and alert by email/Telegram.
- **A cron of `curl -sf https://yoursite.example/health`** from a *different* machine (or a cheap VPS, or an email-driven ping service) if you refuse third parties.

Test the alert path deliberately: kill the service, confirm the message arrives, restart it. An untested alert is a decoration.

## Layer 3: A Watchdog at Home

External services check *you*. A local watchdog checks your *recovery*:

```ini
# systemd user unit, OnFailure= a restart unit
# or simply:
[Service]
Restart=on-failure
RestartSec=5
```

systemd gives you restart-on-crash, a journal, and `systemctl status` for free — for the app, the search daemon, and any timer you run. For subtler failures (process alive but answering garbage), add a watchdog script that curls `/health`, and restarts on repeated non-200s.

## Layer 4: The Metrics Worth a Graph

Three numbers catch most regressions on a small site:

1. **Response time** p95 per route — the user's actual experience.
2. **Error rate** (5xx / total) — correctness over time.
3. **Zero-result search ratio** — quality of the index, and an early spam signal.

Log lines feed them cheaply: one JSON per request, aggregated later. Only build more once these three stop surprising you.

## Alert Hygiene

- **Alert on symptoms users feel**, not on internals you can fix calmly (disk at 70% is a task; p95 at 6s is a page).
- **One channel, deduplicated.** Five noisy channels become one ignored channel.
- **Every alert needs a runbook line**: what to check first, what is safe to restart. If nobody knows the first step, the alert is theatre.

## The Honest Minimum

If you do nothing else: `/health` that checks dependencies, one external checker with a tested alert, and `Restart=on-failure` on every unit. That stack is free, takes an afternoon, and it is the difference between "our users told us it was down" and "we told our users first".
