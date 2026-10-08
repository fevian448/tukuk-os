SLUG: redis-cache-pantas-untuk-aplikasi-web
TITLE: Redis as a Cache: How to Speed Up Your Web Application
EXCERPT: Redis keeps data in memory so web apps skip expensive database queries, cutting latency and freeing up server resources.
TAGS: redis, caching, performance, backend

## Introduction

Most slow web applications are not slow because the code is broken, but because they read the same data over and over from the database. Every request triggers a query, an index scan, a busy connection pool, and it all multiplies as traffic grows. A **cache** is a fast storage layer sitting between the application and expensive data sources, and **Redis** is the most common choice for the role because it keeps everything in memory.

In this post we walk through a practical caching flow: when to cache, how to avoid stale data, and the mistakes that make a cache slow a system down.

## Why Redis Is Fast

Redis runs as an **in-memory data store**, meaning it never has to read a hard disk to answer a request. Typical latency for a single GET/SET operation sits in the sub-millisecond range, far quicker than a SQL query passing through computation, locks, and data transfer.

Other features that matter for caching:

- Simple structures such as strings, hashes, lists, and sorted sets — ideal for JSON-shaped results.
- **TTL (time to live)** at the key level, so cached data expires on its own without a manual cleanup job.
- Optional persistence (RDB or AOF) you can disable when the cache rebuilds from the database.
- Pipelines and Lua scripts that cut round trips between application and server.

For a pure cache workload, disable persistence and use a **maxmemory** configuration with an eviction policy like allkeys-lru, so Redis drops the least-used keys once memory is full.

## Caching Patterns That Work

Three patterns web developers use most:

1. **Cache-aside (lazy loading)** — the application reads the cache first; on a miss it queries the database and writes the result into Redis. The most flexible and most widely used option.
2. **Write-through** — every database write is written to the cache at the same time. Better consistency, but higher write latency.
3. **Read-through** — the cache itself fetches from the database, so the application only ever talks to the cache.

A short cache-aside example: first check key user:1042:profile. If it exists, return it. If not, run the query, store the result with a TTL of 300 seconds, then return it. After five minutes the key expires and the cycle repeats.

One rule matters most: **always set a TTL**. Keys without a TTL that nobody deletes are the number one cause of Redis memory creeping up silently.

## Common Mistakes and How to Avoid Them

**Cache stampede** happens when thousands of concurrent requests discover a key has expired and all hit the database at the same moment. Fix it by adding random jitter to TTLs, or use a *singleflight* approach so only one thread refills the cache while the rest wait.

**Cache penetration** happens when requests for keys that do not exist (a fake product ID) are never stored, so the database is queried every time. Cache the empty result with a short TTL such as 60 seconds.

**Cache avalanche** is the situation where millions of keys are populated at once and expire at once because they were all created at the same time. The fix is spreading TTLs out.

Other mistakes seen often:

- Storing oversized objects (over 10 KB) in a single key, which harms memory fluidity.
- Not capping cache size, letting Redis get killed by the OOM killer.
- Treating the cache as the only source of truth; losing Redis should cause *degradation*, not a 500 error.
- Changing key formats without versioning, leaving old data unreachable.

## Practical Steps and Monitoring

### Track the right metrics

You cannot optimize what you do not measure. Watch the **cache hit ratio** — the share of requests answered by Redis versus those falling through to the database. Above 90 percent is considered healthy for read-heavy workloads; below 50 percent means your key strategy or TTLs need a rethink.

Use INFO stats, SLOWLOG, and MEMORY STATS to see trends, paired with application metrics: average response time, queries per second, and database CPU. When the hit ratio climbs 20 points, database queries drop sharply and CPU headroom returns.

### From Measurement to Rollout

1. Identify the five most frequent queries in your application and measure each one's cost.
2. Install Redis with an explicit maxmemory setting and a suitable eviction policy.
3. Implement cache-aside for those queries with TTLs between 60 and 900 seconds, plus jitter.
4. Provide a fallback so the application keeps working when Redis is down.
5. Build a hit ratio dashboard and set an alert threshold at 70 percent.
6. Re-test under load and compare p50 and p95 latency before and after.

A well-designed cache typically cuts response latency by 5 to 20 times on read-heavy endpoints while easing pressure on your primary database.

## Conclusion

Redis is more than a nice toolkit addition; it can reshape a web application's performance profile. The key is clear constraints: mandatory TTLs, realistic size limits, refill strategies that handle stampede, and consistent hit ratio monitoring. Start small with a few read-heavy endpoints, measure, then roll the proven pattern across the application.
