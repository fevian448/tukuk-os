SLUG: cloudflare-workers-serverless-di-edge
TITLE: Cloudflare Workers: Running Serverless Code at the Edge
EXCERPT: Cloudflare Workers let you run JavaScript and WebAssembly close to users, cutting the round trip to origin servers and measurably reducing latency.
TAGS: serverless, edge-computing, cloudflare, javascript

## Introduction

The traditional server model places your application in one or two geographic regions. When a user in Kuala Lumpur reaches a server in Frankfurt, every request pays for thousands of kilometres of fibre plus several TCP and TLS **handshakes** before content starts returning. That is the **latency** no amount of code optimization can remove.

**Cloudflare Workers** solve this by running your code on an **edge** network spanning hundreds of locations worldwide. Code executes close to users, often under 50 ms away. This post explains how Workers work, what they are and are not suited to, and the best practices to follow when building your first edge application.

## How Workers Work

Every request passing through the Cloudflare network can be intercepted by a **worker**. Your worker exports a single entry function that receives a Request and returns a Response — the same model as a standard fetch handler.

The big difference is the execution environment:

1. Code runs in isolates based on **V8 isolates**, not full containers or virtual machines. Startup is usually under 5 milliseconds, far faster than a cold-started function on other serverless platforms.
2. Each request gets its own isolate, with no memory shared between requests, which limits the risk of state leaks.
3. Strict time and CPU limits apply; the free plan allows a high daily request quota while CPU is metered in milliseconds.
4. Access to KV, Durable Objects, R2, D1, and Queues lets a full architecture run without a traditional server.

Because no container has to boot, **cold start** barely exists in the usual sense, and scaling happens automatically since every isolate is short-lived.

## What Suits the Edge and What Does Not

Workers are excellent for work that is brief, stateless, and needs fast decisions based on request context:

- **Routing and rewrites** — sending users to a subdomain, language version, or regional mirror.
- **Light authentication** — validating JWTs and rejecting invalid requests before they reach origin, saving backend compute cost.
- **A/B testing and personalisation** — choosing a variant from a cookie or region header.
- **Smart caching** — manipulating cache headers, running stale-while-revalidate, and combining responses from several sources.
- **Privacy middleware** — hiding the original IP, stripping analytics identifiers, and filtering data before it reaches third parties.

For an independent search engine like Tukuk-OS, the edge layer is useful for filtering requests, enforcing rate limits, and serving cached responses before touching the index cluster.

### What Does Not Fit

These limits are worth understanding before you build:

- CPU caps mean heavy work such as large model inference, video processing, or complex multi-table queries does not belong inside a worker.
- Round trips back to your own servers add the latency you were trying to remove — avoid patterns that always call origin.
- Long-running work past the request timeout will be cut off.
- Debugging is harder because of the unique isolation environment, although wrangler tail provides helpful live logs.

A common strategy is to keep the worker as a thin decision layer and dispatch heavy work to dedicated services called asynchronously.

## Best Practices While Building

1. Keep the worker small and focused. One responsibility, one function, easy to test.
2. Minimise environment reads and loops over bindings; every binding access has a cost.
3. Use **Durable Objects** only when you truly need synchronized state — the cost and complexity are not worth it for a simple counter.
4. Never hardcode secrets in code; use encrypted bindings and platform-held secrets.
5. Test with wrangler dev locally before deploying, because edge environment differences are hard to spot in production.
6. Track CPU time and usage from day one; a flat chart is a sign of healthy code.

The most common mistake is building an entire API inside one worker until it becomes a serverless monolith. Split it into small functions and let versioning happen at the deployment level.

## Practical Steps to Start a Project

1. Install the wrangler CLI and run the Hello World template to understand the project layout.
2. Pick one existing endpoint that takes high traffic, such as the search page, and move its response logic to the edge.
3. Cache the response in KV with a short TTL and compare latency before and after.
4. Add alerts based on error rate and CPU time.
5. Expand to other patterns such as bot filtering and static content delivery once the first pattern is proven.

A figure you often see: moving a lightweight response from a single-region server to the edge cuts cross-region **TTFB** from 200–400 ms down to 20–60 ms.

## Conclusion

Cloudflare Workers lower the barrier to **edge** computing: no server management, fast isolate startup, and global reach from the very first deploy. The key to success is choosing work that is small, brief, and latency-sensitive to run at the edge while heavy work stays on servers or dedicated services. Build small, measure the real latency impact, and scale only after metrics confirm the approach is worth it.
