SLUG: service-worker-caching-network-first-vs-cache-first
TITLE: Service Worker Caching: The Night Cache-First Served the Wrong Page
EXCERPT: A service worker that cached every navigation served users stale — and sometimes wrong — HTML for hours; network-first for navigations fixed it without giving up speed.
TAGS: service worker, pwa, caching, performance

## The Bug Nobody Saw in Development

The site looked perfect on our machines. Users reported something stranger: occasional pages that were *almost* right — old layouts, missing features, sometimes content from a different section entirely.

The cause was our service worker. Its fetch handler treated **every** request the same way: return from cache if present, fetch in the background, update the cache for next time. Fast, offline-friendly — and, for HTML documents, wrong.

## Why Cache-First Breaks Navigation

A service worker's strategy choices are per-resource-class, and they exist for a reason:

- **Cache-first** suits immutable assets: hashed JS bundles, fonts, images. The URL changes when the content changes, so a cached copy is always valid.
- **Network-first** suits HTML: the document is the *entry point* that references those assets. Serving a stale document can reference old JS, run old logic, and override the fresh experience the user asked for.
- **Stale-while-revalidate** is a compromise — but for navigation it still flashes the old page first, which is exactly the confusion users reported.

Worse, our worker cached the *first* HTML it ever saw. Search pages are generated client-side from that one document, so a user who arrived before a feature launch kept the pre-launch document through every search, every tab switch, every reload — until a full cache eviction.

## The Fix

We split by request type:

```js
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.mode === 'navigate') {
    // Pages: always try the network, fall back to cache offline.
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }
  if (new URL(req.url).origin === location.origin) {
    // Same-origin static assets: cache-first is fine.
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      }))
    );
    return;
  }
  // Cross-origin: leave alone.
});
```

Plus two supporting changes:

1. **A cache version bump** (`tukuk-os-v1` → `v2`) with deletion of old caches on activate — otherwise users keep the old cache forever.
2. **`Cache-Control: no-cache` on HTML and `no-store` on the service worker script itself** — so HTTP caching cannot reintroduce staleness beneath the worker.

## The Verification Habit

After the fix we stopped trusting screenshots and checked what the server actually delivered: response headers via `curl`, access logs during real user sessions, and byte-comparison of the served document against the deployed one. The server never lied; our test browser had simply been showing a blessed cache.

## Rules of Thumb

- Navigations: **network-first** (with offline fallback).
- Hashed assets: **cache-first**.
- The service worker script: **never cached**.
- HTML from HTTP: **revalidate every time**.
- Bump your cache version in the same commit as any behaviour change.

Speed and freshness are not opposites — they are different strategies for different classes of file, and the class you must never cache-first is the one that decides everything else.
