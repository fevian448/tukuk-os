SLUG: indexnow-submit-urls-instantly-to-bing
TITLE: IndexNow: Submitting URLs to Bing (and Friends) the Moment They Publish
EXCERPT: IndexNow is a push-based protocol — your site tells search engines what changed instead of waiting for a crawl — and it takes about twenty lines of script to set up.
TAGS: seo, indexnow, bing, search engines

## Crawl-Based Indexing Has a Delay

Classic indexing is pull-based: you publish, and eventually a crawler arrives. For a site adding articles daily, "eventually" can mean hours to days — and for corrections or deleted pages, the stale copy lives in the index longer still.

**IndexNow** inverts that. The moment something changes, your server *pushes* the URLs to participating engines. Bing, Yandex, Seznam, Naver, and others fetch them within seconds to minutes. (Google does not participate — it prefers its own tooling — so this is a complement to Search Console, not a replacement.)

## The Protocol in Three Steps

1. **Host a key file.** Generate any 32-character hex string, serve it at `https://yoursite.example/<key>.txt` with the plain-text body being the key itself. This proves you control the domain.
2. **POST a JSON payload** to any IndexNow endpoint (`https://api.indexnow.org/indexnow`, or bing's own):

```json
{
  "host": "yoursite.example",
  "key": "bd8f0317c5ab4cddb9a3dc62f7ec15ae",
  "keyLocation": "https://yoursite.example/bd8f0317c5ab4cddb9a3dc62f7ec15ae.txt",
  "urlList": ["https://yoursite.example/blog/new-post"]
}
```

3. **Receive HTTP 200.** Errors are explicit: `400` for a malformed body, `403` when the key file does not match, `422` when URLs point to a different host than declared.

That is the entire protocol — no SDK, no authentication handshake, no per-engine account.

## What We Got Wrong First

Our first submission failed with **HTTP 422**. The script was sending the literal string `url=all` as a "URL" — a shell-mode mistake where a convenience flag passed through to the API untouched. Search engines validate hard: every entry in `urlList` must be an absolute, correctly encoded URL on the declared host.

Fixes worth copying:

- **Validate before sending.** Reject anything that does not parse as `https://<host>/...`.
- **Accept `all` as a keyword** in your CLI and expand it from the live sitemap — do not forward raw arguments to the API.
- **Batch sensibly.** Up to 10,000 URLs per request are allowed; we submit the full sitemap in one call, which keeps audit logs tidy.

After the fix, **54 URLs posted in a single request, HTTP 200**.

## A Practical Workflow

```bash
# publish → submit changed URLs → confirm 200
curl -s -X POST "https://api.indexnow.org/indexnow" \
  -H "Content-Type: application/json; charset=utf-8" \
  -d @submit.json
```

Wire it into your deploy: CI job, post-save hook, or a scheduled script that diffs the sitemap. The cost is one HTTP request; the benefit is that corrections and new articles reach the index while they are still news.

## Limits to Remember

- IndexNow **notifies**; it does not guarantee ranking or even immediate indexing — engines still fetch and evaluate.
- Google is out — keep Search Console + its own sitemap ping habits alongside.
- Submitting spammy URLs repeatedly erodes trust; push what actually changed.

Push-based indexing is one of those rare SEO features where the correct setup is also the simple one: a key file, a JSON body, and a habit of submitting on publish.
