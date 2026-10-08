SLUG: parsing-search-results-language-market-signals
TITLE: Parsing Bing Results: How Market Parameters Decide Your Language
EXCERPT: The same query can return English gold or decorative junk depending on locale parameters — validating result relevance is part of parsing, not an optional extra.
TAGS: web scraping, bing, parsing, i18n

## The Query That Came Back Wrong

We run a small federated search: when our own index cannot answer, we ask a major search engine and parse the HTML. One day a generic English query — `artificial intelligence` — returned results that were perfectly *ranked* and completely *wrong*: tracker redirect URLs, decoy titles, pages about other topics entirely.

Nothing had broken in our parser. The **market** had changed underneath it.

## Locale Is Part of the Query

Search engines infer language from two layers:

1. **Explicit URL parameters** — `setmkt=en-us`, `setlang=en`, and friends tell the engine which market to serve.
2. **Implicit headers** — `Accept-Language` announces what the *client* prefers.

Our crawler was sending `Accept-Language: ms-MY`. Combined with a generic query string, that was enough for the engine to serve a Malay-market result set — with the accompanying layout variants, different ad/decoy structures, and filtered URL patterns our regex did not expect.

The fix started with one line:

```js
headers: { 'Accept-Language': 'en-US,en;q=0.9' }
```

…and continued in the URL: `&setmkt=en-us&setlang=en&ensearch=1`.

## Parameters Alone Are Not Enough

We tested a matrix — client locale (EN/MY) × market parameters (explicit/plain) — and two quadrants still failed:

- English client + plain parameters occasionally returned CJK-language results (edge nodes overriding).
- Malay client + explicit `en-us` parameters returned decoy junk (the parameter was present but the response variant did not match).

So the parser learned to be **skeptical of its own success**. Before accepting a candidate result, it validates *relevance*:

```js
function looksRelevant(hits, query) {
  const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
  if (!hits.length) return false;
  const sample = hits.slice(0, 5)
    .map((h) => `${h.title} ${h.url} ${h.description}`.toLowerCase())
    .join(' ');
  const matches = terms.filter((t) => sample.includes(t)).length;
  return matches >= Math.max(1, Math.ceil(terms.length * 0.5));
}
```

If validation fails, **retry with plain parameters** — drop the market hints entirely — and validate again. One of the two paths consistently returns a clean, relevant, correctly-language result set.

## The Deeper Lesson

HTML result parsing is a distribution problem, not a regex problem:

- **Detect junk structurally** — titles that are empty, URLs that are pure tracking redirects, descriptions that repeat the domain.
- **Validate against the query** — a "successful" parse of irrelevant results is worse than an error, because downstream code trusts it.
- **Log the market, not just the query** — our access logs once showed `q=ai` returning fine while every *click* led nowhere; the market metadata in the request explained it in one line.
- **Keep a fallback ladder** — primary parameters, plain retry, then the local index — and record which rung answered.

Language signals are not noise around the real search problem. At the edges of the web, they *are* the search problem.
