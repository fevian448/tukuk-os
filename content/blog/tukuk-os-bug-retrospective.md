SLUG: tukuk-os-bug-retrospective
TITLE: Tukuk-OS Bug Retrospective: Four Real Bugs and What They Cost
EXCERPT: A merge script that copied zero documents, a service worker serving yesterday's site, Bing returning decoy results, and a video player nobody could open — four real bugs from this project, written up while the scars are fresh.
TAGS: bugs, debugging, case study, tukuk-os

## Why Write Your Own Bugs Down

Famous incident write-ups are educational; your own are *motivating*. These four happened in this project, in order, and each taught a lesson no tutorial delivered — because tutorials do not have production users clicking things.

## Bug 1: The Merge That Copied Nothing

**Symptom.** Broad search queries returned a dozen weak hits. The primary index held 25 documents while a forgotten test index held 32,272. A merge script was written to copy everything over.

**What happened.** The script ran, printed progress… and finished with **"0 documents copied"** while the source index still reported 32,272 documents. The API call was not failing; it was *succeeding differently than expected*. The search client's `getDocuments` returned `{ results: [...], offset, limit, total }` — an object, not an array. The code did `if (!docs.length) break` on an object, saw `undefined`, and treated it as "no more data" on the very first batch.

**The fix.** One line of normalisation (`res.results || res`), plus a hard assertion at the end: `expect(copied > 0)`.

**The lesson.** *Silent early exit is the worst failure mode a loop can have.* Any loop that ends needs to be compared against what "complete" was supposed to look like — a final count, a checksum, an expected total. The script printed a cheerful success message while doing nothing; we now print the count and compare it to the source stats.

**Cost:** one evening, plus a healthy suspicion of every wrapper type a library returns.

## Bug 2: The Site That Served Yesterday

**Symptom.** Users reported pages that were "almost right" — old layouts, missing features. Our machines always looked perfect.

**What happened.** The service worker cached **every navigation** cache-first: return the stored document, refresh in the background. For hashed assets, that is ideal. For the HTML entry point, it means the browser runs *last visit's JavaScript* on *this visit's requests* — including a fresh video-player feature that did not exist in the cached copy. The user clicked a video, ran old code, and got an ordinary external link.

**The fix.** Split by request type: **network-first for navigations** (cache only as offline fallback), cache-first for same-origin static assets, `no-store` for the service worker script itself, `no-cache` for HTML at the HTTP layer. Bump the cache version in the same commit as any behaviour change.

**The lesson.** *Stale UI bugs masquerade as broken code.* Before debugging a feature, verify what bytes the user actually received: `curl -s https://site/ | grep your-feature`. Screenshots lie; served bytes do not. Half of "it doesn't work" is "it doesn't work *here*, on a page loaded before you deployed".

**Cost:** a day of suspicion — until we stopped trusting the browser and read the response headers.

## Bug 3: Results That Were Perfectly Wrong

**Symptom.** A generic English query returned properly *ranked* results about entirely wrong topics, wrapped in URLs like `bing.com/ck/a?!&p=...&u=a1<base64>` — tracker redirects instead of real destinations.

**What happened.** Two bugs stacked:

1. **Language market leaking in.** Our crawler sent `Accept-Language: ms-MY`, and the search engine answered with a Malay-market result variant — different decoy structures, different link formats, which our parser did not expect.
2. **HTML entities in the parse.** Raw hrefs contained `&amp;u=a1...`, so the regex looking for `[?&]u=a1` never matched, and users got the tracker URL instead of the decoded destination.

**The fix.** Pin `Accept-Language: en-US` and market parameters in the request; unescape `&amp;` → `&` before decoding; and — the important part — **validate relevance**: if the parsed results do not share terms with the query, reject them and retry with plain parameters. A successful parse of irrelevant results is worse than an error.

**The lesson.** *Parsers need an opinion about their own output.* Range-check the numbers, relevance-check the results, format-check the HTML — otherwise you faithfully propagate garbage with a `200 OK`.

**Cost:** several quiet queries returning nonsense that looked entirely legitimate.

## Bug 4: The Video Player That Opened YouTube

**Symptom.** The inline video modal shipped, worked perfectly in testing… and a real user reported that clicking a video still navigated away to YouTube.

**What happened.** Nothing was wrong with the modal. The user's tab had been open since *before* the feature existed; searches ran through in-page AJAX, so the page never reloaded and never got the new JavaScript. Their browser had been executing yesterday's code all session. Compounding it: HTML was served with `max-age=3600`, and the old service worker kept a stale copy for good measure.

**The fix.** Three layers: tell the user to reload (immediate), serve HTML `no-cache` and the service worker `no-store` (structural), and document the diagnosis order for the next "feature doesn't work" report: **check the served bytes first, then the cache, then the code.**

**The lesson.** *Deploying is not delivering.* A feature is not shipped until the user's browser is running it — which means cache headers, service workers, and long-lived tabs are part of the feature's blast radius.

**Cost:** one confused user, one support exchange, and a permanent entry in the incident checklist.

## The Pattern Across All Four

| Bug | Real failure |
|---|---|
| Merge copied nothing | Loop ended "successfully" without checking the outcome |
| Stale site | Trusting that the client runs what the server last built |
| Decy/trackers | Accepting parsed output without validating meaning |
| Dead video modal | Assuming deployment equals delivery |

Every one of them is a variant of the same sentence: **something reported success without evidence.** Count the rows. Read the headers. Question the parse. Verify the bytes.

That is now the checklist — and it cost less to write than one more evening of suspicion.
