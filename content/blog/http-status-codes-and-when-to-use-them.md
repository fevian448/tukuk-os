SLUG: http-status-codes-and-when-to-use-them
TITLE: HTTP Status Codes and When to Use Each One
EXCERPT: Status codes are a contract with clients, caches, and crawlers — picking the right one decides whether your API is usable and your SEO is clean.
TAGS: http, api, web fundamentals, seo

## A Contract, Not Decoration

Every HTTP response starts with a three-digit code, and clients *act* on it: browsers show pages, caches store or discard, crawlers index or skip, SDKs retry or give up. Choosing the wrong code is not pedantry — it silently changes behaviour across the entire internet-facing chain.

## The Six Families You Actually Need

**1xx — Informational.** Rare in application code; you will mostly ignore these.

**2xx — Success.**
- `200 OK` — the request worked, body attached (GET, PUT success).
- `201 Created` — a resource now exists; include its location.
- `204 No Content` — succeeded with nothing to say (DELETE is the classic case).

**3xx — Redirection and caching.**
- `301 Moved Permanently` — the URL **has permanently moved**; browsers and crawlers update their records. Wrong for temporary problems: it is cached aggressively.
- `302`/`307` — temporary redirect; keep using the original URL.
- `304 Not Modified` — your `If-None-Match`/`If-Modified-Since` matched; send no body. This is what `no-cache` (revalidate) relies on to stay cheap.

**4xx — the client's mistake.**
- `400 Bad Request` — malformed syntax (broken JSON, invalid encoding).
- `401` vs `403` — **401 = who are you?** (no/invalid credentials); **403 = I know who you are and the answer is no.** Mixing them up breaks every auth library's retry logic.
- `404 Not Found` — resource does not exist.
- `405 Method Not Allowed` — exists, but not for this verb; send an `Allow` header.
- `409 Conflict` — state contradiction (duplicate creation).
- `413 Payload Too Large` — body over your limit; better than dying on OOM.
- `422 Unprocessable Entity` — syntax fine, semantics wrong: this is the honest code for "your URLs point at the wrong host" (IndexNow uses it exactly this way).
- `429 Too Many Requests` — rate limited; send `Retry-After`.

**5xx — your mistake.**
- `500 Internal Server Error` — unhandled exception; the generic crash.
- `502 Bad Gateway` / `504 Gateway Timeout` — an upstream proxy could not get an answer; a reverse proxy emits these when your app is down or slow.
- `503 Service Unavailable` — deliberately down for maintenance; include `Retry-After`.

## Choices That Bite Small Sites

- **Returning 200 with an error body** — every monitoring tool thinks you are healthy. Use `503` on `health` if the app is genuinely broken.
- **404 for API paths that exist but errored** — crawlers delete pages, SDKs cache confusion. Errors are 4xx/5xx; missing is 404.
- **Redirect loops from mixed 301s** — one permanent redirect per hop, always to the canonical host; never 301 back and forth.
- **SPA catch-all serving `index.html` with 200** for every URL — creates infinite soft-404s for crawlers. Serve real `404` (the framework's not-found route) for unknown paths.

## A One-Line Sanity Check

```js
res.status(404).json({ error: 'Halaman tidak dijumpai', path: req.originalUrl });
```

The body helps humans; the **code** drives machines. Get the code right first, then write whatever message you like — caches, crawlers, and client libraries never read your prose.
