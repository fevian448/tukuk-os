SLUG: rss-feeds-for-news-discovery
TITLE: RSS Feeds Are Still the Best Way to Build a News Tab
EXCERPT: Before ranking news, you have to ingest it — and plain RSS over HTTPS remains the fastest, most honest pipeline from publisher to search results.
TAGS: rss, news, feeds, crawling

## The Unfashionable Pipeline

Every few years someone declares RSS dead. Every year after that, thousands of newsrooms quietly keep publishing feeds — because the format is a solved problem: a URL, an XML document, a publish time, a link back to the original.

For a search engine building a **news tab**, feeds beat crawling on almost every axis that matters at small scale:

- **Freshness** — publishers push within minutes of publication; a crawler discovers at its own polite pace.
- **Politeness** — one `GET` per feed per interval, with server-side caching, instead of rendering full article pages.
- **Structure** — title, link, publication date, description, sometimes categories — already parsed.
- **Stability** — feed URLs change rarely; layouts (which crawlers parse) change constantly.

## A Feed Set Worth Starting With

Ten feeds covering technology, science, world news, and a couple of domain-specific sources give a credible international tab:

```text
BBC News      https://feeds.bbci.co.uk/news/rss.xml
TechCrunch    https://techcrunch.com/feed/
NASA          https://www.nasa.gov/feed/
The Verge     https://www.theverge.com/rss/index.xml
```

Add region-specific English sources as the audience grows. Keep the list **small and explicit** — an unbounded feed list becomes an unbounded liability.

## Parsing: Three Details That Bite

1. **Set `xmlMode: true`** in your HTML/XML parser. RSS is XML; default HTML parsing normalises away the tags you need (`<item>` vs `<item>` handling differs across parsers).
2. **Dates are inconsistent.** `<pubDate>` is RFC 822 (`Tue, 06 Oct 2026 08:15:00 GMT`), Atom uses ISO 8601, and some publishers send nonsense. Parse defensively; drop items you cannot date rather than showing them as "just now."
3. **IDs must be stable.** Derive a document ID from a hash of the canonical link — never from array position, or your index reshuffles on every fetch.

```js
const crypto = require('crypto');
const id = crypto.createHash('sha1').update(item.link).digest('hex').slice(0, 16);
```

## Ingestion Rhythm

A system-drawn timer suits news far better than a long-lived daemon:

- **Fetch every 20–30 minutes** — most outlets publish several times a day; hourly is plenty, 15 minutes is rarely wasted.
- **Cache raw XML briefly** (5–10 minutes) so retries and restarts do not hammer publishers.
- **Upsert by ID** — items are idempotent; re-reading the same feed must not duplicate.
- **Rank by `publishedAt` descending** for the empty-query case: the tab's default state is *what's new*.

## RSS + Search = the Whole Tab

The news index is just another Meilisearch collection with a `publishedAt` field. Queries search it like anything else; the empty query orders by date; the UI adds a `News` tab alongside Web, Videos, and Images. No partner API, no key management, no usage caps — just a format that was designed for exactly this job in 1999 and has never been improved upon because it never needed to be.
