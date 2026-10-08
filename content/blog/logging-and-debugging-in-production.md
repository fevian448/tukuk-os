SLUG: logging-and-debugging-in-production
TITLE: Logging and Debugging in Production When You Cannot Attach a Debugger
EXCERPT: Once code runs on a server you cannot step through, logs become your only eyes — structured messages, right levels, and a habit of printing context, not feelings.
TAGS: logging, debugging, nodejs, operations

## The Server Is Not Your Laptop

Locally, you set a breakpoint and inspect variables. On a production box the process is under load, the bug reproduces once an hour, and nobody is going to pause customer traffic so you can poke at memory. **The information you logged at the moment of the error is all you will ever have.**

## Log Levels, Honestly Used

- **error** — something failed; a request died, a job aborted. Alert-worthy.
- **warn** — degraded but survivable: a retry, a slow upstream, a fallback path taken.
- **info** — lifecycle facts: server started, port bound, index migrated.
- **debug** — granular detail you enable temporarily, off by default.

The most common dysfunction is logging everything at `error`, which trains you to ignore errors. The second most common is logging nothing but happy paths, which guarantees the one crash you care about is undocumented.

## Print Context, Not Feelings

Bad: `console.log('something went wrong')`.
Good: `console.error(JSON.stringify({ level: 'error', msg: 'bing parse failed', query, market, url, status, tookMs }))`.

Structure beats prose — a JSON line can be grepped, counted, and filtered six months later:

```bash
journalctl --user -u tukuk-os --since "15 min ago" | grep '"msg":"bing parse failed"'
```

Two rules make logs usable:

1. **Include the identifiers** — request path, query, job id, document id. Without them you have a stack trace and no story.
2. **Never log secrets** — keys, tokens, full request bodies with personal data. Logs are read by ops, shipped to third parties, and kept forever.

## The Cheap Instrumentation That Pays Off

- **One access log line per request** — method, path, status, duration. (`[http] GET /search 200 33ms` answers 80% of "is it down?" questions.)
- **Log slow operations** — anything over your chosen budget (say 1s for a search call).
- **Log retries and fallbacks** — every time a subsystem silently degrades is a future mystery unless you wrote it down.
- **Counters for the boring stuff** — search hits, zero-result queries, index document count. Trends beat single events.

## Debugging Without a Breakpoint

When a bug survives into production, the toolkit is:

1. **Reproduce with the same inputs** — pull the exact query/path from logs and replay it locally with `curl`.
2. **Bisect by logging** — add targeted lines around the suspect logic, ship, narrow, remove. Do not enable `debug` globally on a busy box; the noise buries the signal.
3. **Check the boring explanations first** — stale cache (the bug is old code, literally), restarted-but-half-configured process, disk full, DNS lying. Most "mysterious" incidents are mundane.
4. **Verify what the server actually sent** — `curl -sI https://yoursite.example/ | grep cache-control` settles arguments with your own browser's cache in seconds.

## Rotation and Retention

Logs grow without limit. Set rotation (systemd `LogRotation` or `logrotate`), keep hot logs locally, and ship cold logs elsewhere if you need history. A log you cannot find is a log that never existed; a log disk that fills to 100% takes the whole server with it.

Good logging is detective work you do for your future self — at the exact moment when future-you will have the least information and the most pressure.
