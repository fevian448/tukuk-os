SLUG: rate-limiting-and-basic-abuse-protection
TITLE: Rate Limiting and Basic Abuse Protection for Small Web Apps
EXCERPT: One `express-rate-limit` rule and a couple of sensible timeouts stand between your hobby server and a script that bills you for bandwidth you never used.
TAGS: security, rate limiting, express, operations

## What Abuse Actually Looks Like

Nobody needs to "hack" you. The typical first contact is dumber: a scraper looping through your search endpoint, someone testing stolen API keys, a crawler hammering `/sitemap.xml` every second, or a single misconfigured client retrying in a tight loop. Your logs fill, your latency climbs, and an honest user waits behind them.

**Rate limiting** puts a number on politeness: N requests per window, per client.

## The Minimum Viable Rule

With `express-rate-limit`:

```js
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,   // RateLimit-Limit / RateLimit-Remaining
  legacyHeaders: false,
  message: { error: 'Too many requests, slow down.' }
});
app.use('/search', limiter);
```

Details that matter:

- **Per-route budgets.** Cheap endpoints (`/health`) deserve unlimited or high limits; expensive ones (search, ask, crawl) deserve tight ones. One global number punishes the wrong users.
- **`standardHeaders`** — clients see `RateLimit-Remaining` and can back off *before* being refused. Politeness is a protocol, not a surprise.
- **Return `429`, not `500`.** Automation libraries recognise 429 (and `Retry-After`) and retry sanely; a 500 makes them hammer harder.

## Identifying "One Client"

The naive default keys on IP address. That is imperfect — corporate NAT and mobile carriers share IPs — but it is still the right first line. Behind Cloudflare, read the client IP from the correct header (`CF-Connecting-IP`), never from an arbitrary `X-Forwarded-For` the client can forge.

For API-key endpoints, key on the **key** instead: one abusive customer gets throttled without touching everyone sharing their office's IP.

## The Other Half: Timeouts and Body Limits

Rate limiting caps requests per second; it does not stop **one** request from eating your afternoon:

- `express.json({ limit: '2mb' })` — refuse bodies you never wanted (an unlimited JSON parser is a memory-exhaustion tool).
- Upstream fetch timeouts — every external call (search engines, feeds, APIs) needs a deadline; a hanging upstream should fail your request in a second, not thirty.
- Per-route timeouts on expensive handlers — search should answer or error within a fixed budget.

## Watching for the Zero-Result Flood

A useful custom signal: count **zero-result queries** per time window. Humans produce some; a script produces a stream of random strings. Alerting on the ratio catches junk traffic that passes rate limits simply by staying just under them.

## What Not to Bother With (Yet)

Do not start with CAPTCHAs, device fingerprinting, or ML-based bot detection. For a small site the ladder is: sane limits → timeouts → body caps → good logs → and only then cleverness. Ninety percent of abuse stops at rung one, and rung one is fifteen lines of configuration.

Cheap defences you actually configure beat sophisticated ones you only read about.
