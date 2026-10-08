SLUG: scaling-a-search-index-25-to-32000-documents
TITLE: Scaling a Search Index from 25 to 32,000 Documents in One Evening
EXCERPT: Our primary index quietly held two dozen pages while a forgotten test index held 32,000 — the fix was a merge script, but the lesson was about index discipline.
TAGS: meilisearch, indexing, search, operations

## The Symptom

Search results for broad queries were suspiciously thin. `climate change` — a topic with millions of pages — returned a dozen hits, all mediocre. The engine itself answered in milliseconds, health checks were green, and nothing in the logs looked wrong.

The index was simply small. Our primary `halaman_web` index contained **25 documents**, most of them noise: duplicate example domains, a couple of registry pages, crawl test artefacts. Meanwhile a secondary index named `uji_coba` — created during early dataset experiments and never cleaned up — held **32,272 documents**, overwhelmingly English news and feature articles.

Two indexes, one of them forgotten, split the corpus. Queries hit the wrong half.

## Why Split Indices Happen

Index sprawl has familiar causes:

- Experiments start with a new index "so we do not break production" — and then the experiment becomes production by accident.
- Schema migrations create `index_v2` and the old one never dies.
- Import scripts write to a hardcoded name while the app reads a different one.

The social fix is boring: name indices for their *role*, document every import target, and delete or archive experiment indices the day the experiment ends.

## The Merge

Because both indices shared the same Meilisearch schema (identical field names and types), the migration was a copy, not a transform:

```js
const from = client.index('uji_coba');
const to   = client.index('halaman_web');
let offset = 0;

for (;;) {
  const res = await from.getDocuments({ offset, limit: 1000 });
  const docs = res.results || [];
  if (!docs.length) break;
  const task = await to.addDocuments(docs);
  await client.tasks.waitForTask(task.taskUid);
  offset += docs.length;
}
```

Three details that bit us first:

1. **The client returns `{ results, offset, limit, total }`** from `getDocuments` — not a bare array. Treating it as an array yields zero rows and a very confusing "0 documents copied."
2. **Writes are asynchronous.** `addDocuments` returns a *task*; waiting on `waitForTask` (not the removed `waitForTask` on the client root) prevents the next batch from racing the last.
3. **Back up first.** A snapshot costs seconds and turns a risky operation into a reversible one.

After the run: `halaman_web` held **32,297 documents**, and the same broad queries returned full pages of relevant results immediately — no re-ranking, no re-crawling.

## What We Changed Afterwards

- A single documented pipeline: every importer writes to the canonical index.
- A startup check comparing configured index names against expected ones.
- Stale experiment indices exported and removed.
- Result-count sanity in monitoring: a "suspiciously few hits" alert for the most common queries.

## The Takeaway

Search quality problems are often **data-plumbing problems wearing a ranking costume.** Before tuning analyzers or embeddings, check how many documents the query is actually searching — a one-line stats call that would have saved us the whole evening of suspicion.
