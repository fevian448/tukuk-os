SLUG: browser-devtools-for-backend-people
TITLE: Browser DevTools for Backend People: Ten Panels That Pay Rent
EXCERPT: You built the API but never opened the Network tab — that is why you argue with your own frontend. DevTools is not a frontend-only tool.
TAGS: devtools, debugging, http, frontend

## Why a Backend Developer Needs the Network Tab

Two developers, one bug: the API returns `404`, the frontend insists it sent the right request, the backend swears the route exists. The Network tab ends the argument in ten seconds with a single line showing the **exact URL, method, headers, and status** that actually crossed the wire. Half of all "backend bugs" are discovered to be requests that never arrived as expected.

## The Panels Worth Knowing

**1. Network — the source of truth.** Shows every request with method, status, size, and time. Key habits:
- Filter by `Fetch/XHR` to cut out images.
- Right-click → *Copy as cURL* to replay any request in your terminal — the fastest way to prove whether a bug is client-side or server-side.
- Read `cf-cache-status` / `x-cache` headers to learn whether your CDN answered instead of your server.

**2. Console — logs and one-liners.** Your `console.log` output lands here; so do uncaught exceptions with stack traces pointing at the exact line. `copy(document.title)`, DOM queries, and quick experiments all live here.

**3. Elements — the served HTML, not your source.** When "I changed it and nothing happened", the culprit is almost always a cached response. Compare what Elements shows against your file on disk — if they differ, you are debugging yesterday's deployment (a service worker or edge cache is serving stale bytes).

**4. Application (Storage) — caches, cookies, storage.** See every cookie, every Cache Storage entry, every localStorage key. When a test behaves differently from a fresh profile, this panel shows what the profile is *carrying*.

**5. Performance — where the 2 seconds went.** Flame charts of script execution, layout, and network waterfall. For API people: watch how many serial round trips your page makes; that is your endpoint's latency multiplied.

**6. Lighthouse — a single score with a checklist.** Performance, accessibility, SEO, best practices. Not gospel, but each failed audit links to a concrete fix.

## The Console Cheat Sheet

```js
fetch('/search?q=test').then(r => r.status)      // probe your own API from the page
performance.getEntriesByType('resource')          // what loaded, from where
navigator.serviceWorker.getRegistrations()        // is a worker controlling this page?
```

That third line is the answer to a whole class of "my changes don't appear" mysteries.

## The Stale-Page Protocol

When results look wrong:

1. **Hard reload** (`Ctrl+Shift+R`) — bypasses HTTP cache.
2. **Application → Clear storage** — evicts service worker caches.
3. **Verify the served bytes**: `curl -sI` for cache headers, `curl -s | grep your-marker` for content.
4. Only then suspect your code.

Screenshots lie when caches are involved; headers do not.

## Incognito Is Your Clean Room

A private window starts with no cache, no service worker, no extensions. Reproduce the user's "fresh" experience there before instrumenting anything else.

DevTools costs nothing and removes the most expensive habit in software development: **arguing about what you think happened instead of looking at what did.**
