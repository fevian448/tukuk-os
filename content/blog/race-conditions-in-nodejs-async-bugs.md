SLUG: race-conditions-in-nodejs-async-bugs
TITLE: Race Conditions in Node.js: The Bugs That Only Happen Under Load
EXCERPT: Your code works in testing and fails in production because two requests arrived 40 milliseconds apart — here are the async patterns that cause it and how to close the windows.
TAGS: nodejs, async, bugs, concurrency

## What a Race Condition Actually Is

A race condition is not a crash — it is **two operations whose correctness depends on order, in a system that does not guarantee order**. The code reads a value, decides something, and acts — while another operation changes that value in between. On your laptop, with one user, the window never opens. Under load, it opens constantly.

Node's single thread lulls people into thinking races cannot happen. The thread is singular; **time is not**. Every `await` is a yield point where another request gets to run.

## Pattern 1: Read-Modify-Write

```js
// BROKEN: two requests can both read count=41 before either writes
const row = await db.get('stats');
row.count += 1;
await db.set('stats', row);
```

Both requests read `41`, both write `42` — one increment lost. It will pass every test you write for one user.

**Fixes, in order of preference:**

1. **Atomic operation**: `await db.incr('stats', 1)` — one command, server-side.
2. **Transaction with locking**: `BEGIN; SELECT ... FOR UPDATE; UPDATE; COMMIT`.
3. **Serialize in-process**: a promise queue for that key (works only while you have one process).

The mental rule: **any `get` followed by a `set` derived from the `get` is a candidate.**

## Pattern 2: The Overlapping Job

```js
// BROKEN: two timer ticks rebuild the index at once
async function rebuildIndex() {
  const docs = await collectDocs();
  await index.replaceAll(docs);   // tick 2 starts before tick 1 finishes
}
```

Two rebuilds interleave; the index ends up half-old, half-new — or throws on a constraint. Fixes: an `inProgress` boolean guard, a proper mutex, or a job queue that coalesces ("if a rebuild is queued, don't queue another").

Guard code must itself be atomic within the event loop:

```js
let rebuilding = false;
async function rebuildIndex() {
  if (rebuilding) return;
  rebuilding = true;
  try { /* ... */ } finally { rebuilding = false; }
}
```

The `try/finally` matters — one unhandled rejection without it leaves the flag stuck and the feature dead until restart.

## Pattern 3: Promise Left on the Table

```js
// BUG: the promise floats — errors vanish, order not guaranteed
doBackup();          // no await, no .catch
await handleRequest();
```

Floating promises reorder side effects and **swallow failures silently**. If you mean "do it later", say so: `void doBackup().catch(log)`. If you mean "do it now", `await` it. The absence of `await` should never be an accident.

## Pattern 4: Check-Then-Act Across Requests

```js
if (!await cache.has(key)) {          // request A passes
  const data = await expensiveFetch(); // A and B both fetch
  await cache.set(key, data);          // duplicated work
}
```

Wasted work, duplicated side effects. Fixes: single-flight caching (share the in-flight promise per key), or accept the duplication if it is harmless and cheap.

## Pattern 5: Filesystem Order

Watching a directory while writing into it: the watcher fires while the write is half-done, downstream processes read a truncated file. **Write to a temp name, then `fs.rename`** — atomic on the same filesystem. Every half-written config, index, and backup in the wild came from skipping this.

## How to Hunt Them

- **Load-test with concurrency** — `hey -n 200 -c 20 'https://yoursite/search?q=x'` while watching logs for interleaved job markers.
- **Log the timestamps and ids** of each phase (`job started / read / wrote`) — races are obvious in interleaved logs and invisible in code review.
- **Restart tests**: kill the process mid-operation and see if state survives (another flavour of the same window).
- **Add a deliberate delay** (`await sleep(50)`) inside the suspect window during testing — if the bug becomes trivial to reproduce, you have found the race.

## The Discipline

Every bug of this class is a sentence with a hidden "and nothing else happens in between". Your job is to make that sentence true: atomic operations, locks, queues, or ordering guarantees — chosen deliberately, never by accident of timing.

Node runs your code between other people's requests. Write as if every `await` is a door that someone else can walk through, because it is.
