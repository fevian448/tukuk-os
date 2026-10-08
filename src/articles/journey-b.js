module.exports = [
  {
    oldSlug: 'http-dan-api-pemahaman-asas',
    title: 'HTTP and APIs: The First Language My Server Spoke',
    slug: 'http-and-apis-fundamentals',
    tags: ['HTTP', 'API', 'Backend'],
    excerpt: 'Understanding status codes, request methods, and API design from the perspective of someone sending data across a network for the first time.',
    content: `Before I understood HTTP, I saw \`404\` and \`500\` as mysteries. After understanding them, I realised the whole web is just text sent back and forth with clear rules. HTTP is the language I had to master to make Tukuk-OS communicate with the outside world.

### Request and Response: One Exchange

Every time you open a page, your browser sends a **request** and the server sends a **response**. A request contains a method (\`GET\`, \`POST\`), a path (\`/search\`), headers, and sometimes a body. A response contains a status code, headers, and content.

The first thing I learned is that \`GET\` should not change anything, while \`POST\` sends data to be processed. At first I used \`GET\` for everything including my contact form, until I realised that long questions end up in server logs and browser history. This division is not decoration — it is the foundation of security and privacy.

### Status Codes: Honest in Three Digits

I memorised five status codes before any terminal command:

- **200 OK** — everything is fine.
- **301 Moved Permanently** — the address has moved.
- **400 Bad Request** — your request is wrong, not the server.
- **404 Not Found** — the resource does not exist.
- **500 Internal Server Error** — the server has an internal problem.

In Tukuk-OS I treat these codes carefully. When the NASA APOD endpoint fails I return \`500\` with a clear message, not \`200\` with empty content. My clients (the web pages) then know to retry or show the right error message. Honesty in status codes produces better interfaces.

### Designing APIs: Names That Speak for Themselves

My first API was full of paths like \`/getdata\` and \`/process\`. I then learned that a good path describes a **resource**, not an action: \`/api/nasa/apod\`, \`/api/nasa/asteroids\`, \`/search\`, \`/blog/:slug\`. With that structure a client can guess a route it has never seen.

I also learned to wrap responses in a consistent shape: success returns the data directly, failure returns \`{ "error": "..." }\`. This consistency let me write client code once and use it for every endpoint.

### My First API Design Mistake

My first API had a structural problem I did not notice until I tried to build a second client: every route returned a different data shape. One route returned a list directly, another wrapped it in an object with a \`data\` key, and a third returned a single object even though results were always a list.

As a result my client code was full of special cases — "if the response is a list, do this; if it is an object, do that". Every new route added a new branch. After a few months I rewrote every route to follow a single convention: lists always arrive as lists, objects always as objects, and errors always carry the same \`error\` key.

That rewrite took two days and removed about a hundred lines of special-case handling from my client. The lesson that lasts: **conventions beat flexibility**. When every route looks and behaves like the others, you can write generic code that works with all of them at once — and that is the foundation of the entire Tukuk-OS API layer today.

### Query Parameters and Filtering

\`?q=nasa&limit=20&offset=0\` — query parameters became how I filter results. In Tukuk-OS almost every search endpoint accepts \`q\`, \`limit\`, \`offset\`, plus filters like \`host\`, \`lang\`, and \`type\`. I learned that every parameter I add needs a sensible default so the simplest possible call still works.

### Calling External APIs: A World That Is Not Perfect

When I started calling the NASA API I learned that networks cannot be fully trusted. Requests can time out, servers can fail temporarily, and responses can arrive unlike what you expected.

My biggest lesson here is the **circuit breaker**. When the NASA APOD endpoint starts returning errors repeatedly, I do not want every client waiting thirty seconds for a timeout. I record "this service is failing right now" for ten minutes, then simply use the fallback. That pattern has saved the Tukuk-OS user experience repeatedly.

### HTTP/1.1, HTTP/2 and HTTP/3

Even though I do not write the protocol myself, understanding the differences helps me make configuration decisions. HTTP/2 allows many requests on a single connection, while HTTP/3 (QUIC) reduces connection start latency. When I enabled HTTP/2 behind Cloudflare, Tukuk-OS pages downloaded in parallel instead of sequentially, and the difference was noticeable on slow connections.

### What This Means for Tukuk-OS

Tukuk-OS today is a large set of APIs: search, suggestions, images, videos, NASA data, contact forms, and statistics. Each of them respects the HTTP rules I learned in the early days: correct methods, honest status codes, consistent response shapes, and errors that can be acted upon. Not everything I know about the web came from books; most of it came from seeing a \`500\` on my own screen and asking why.`
  },
  {
    oldSlug: 'membina-indeks-songsang-dengan-tangan',
    title: 'Building an Inverted Index by Hand: My First Search Engine Code',
    slug: 'building-an-inverted-index-by-hand',
    tags: ['Search Engines', 'Inverted Index', 'Algorithms'],
    excerpt: 'Before using an off-the-shelf engine I built my own inverted index in JavaScript — and understood why that structure changes everything.',
    content: `Before I touched Meilisearch, I built my own inverted index. I wanted to understand what happens inside the black box before buying it. That small project — one JavaScript file, a few hundred lines — became the biggest stepping stone in building Tukuk-OS.

### What Is an Inverted Index?

Naive search means reading every document and looking for the word you want. With a hundred documents it might work. With a hundred thousand it would take an unreasonable amount of time.

An inverted index reverses the work: from documents to words. Every unique word maps to a list of document IDs where it appears. Search for "meilisearch" and you instantly get the correct list of documents without reading a single document in full.

### My First Design

My first design was simple: one JavaScript object. Keys are words (normalised to lowercase and stripped of punctuation), values are lists of document IDs. When I add a document I split its text into words, filter out stop words (and, the, is, at), and add the ID to each list.

The first test felt extraordinary. Across a few hundred articles my search returned in a blink. I wrapped \`console.time\` around it and saw \`0.2ms\` for a typical query. I finally understood why search engines feel fast — not because their servers are powerful, but because their data structures are right.

### The Real Challenge: Being Smarter Than Keywords

A basic index only supports "find documents containing all these words". But real search engines must handle partial matches, prefer matches that appear in titles, and compute relevance scores.

I added three layers:

1. **Frequency scoring**: a word that appears often in a short document matters more than in a long one.
2. **Position**: a match in the title earns a higher score.
3. **Proximity**: when two words appear near each other in the same sentence, that is a strong signal.

The third layer took longest but produced the biggest quality jump. It also taught me why you must stop effort at some point: computing proximity for every word pair in every document is too expensive, so I only do it for queries with two or three words.

### How I Measured Index Quality

One problem I did not think about while building: how do I know it works well? Fast scores mean nothing if the returned results are irrelevant.

I wrote a set of test queries — ten questions with answers I knew should appear at the top. Every time I changed the scoring algorithm I ran that set and compared results. Several times my "improvements" made common results worse while improving rare ones — and the test set caught it before the change stuck.

This also taught me that search quality is subjective for some queries. "javascript" could mean tutorials, jobs, or news. For such queries I learned not to over-measure — sometimes a range of reasonable results is better than one forced "correct" answer.

The practice I eventually kept: every search system needs a hand-written set of reference queries. It is small (ten to twenty queries), cheap to run, and it is the only way to know whether your change improves the system or breaks it. I use the same set today when tuning Meilisearch settings for Tukuk-OS.

### Where My Design Failed

My index failed in two ways. First, size: the JavaScript object held everything in memory, and as I added more documents memory usage grew unchecked. Second, features: no faceted search, no fuzzy matching, no autocomplete, and no index management.

I realised I was rebuilding an open source search engine that had taken teams years. That is when I decided to use Meilisearch — but with a deep understanding of what it does under the hood. When I tune \`filterableAttributes\` and \`searchableAttributes\` in Tukuk-OS, I know exactly why each field is placed there.

### Lessons for Search Engine Builders

If you want to understand search engines, do not start with a library. Build the simplest one first: one object, one search function, one test. Then add simple ranking, then scoring, then filters. You will discover for yourself why each feature you create matters — and you will appreciate other people's search engines in a way that is impossible if you have never struggled to build your own.

The inverted index I wrote by hand still exists in my archive. Tukuk-OS does not use it, but it is the most valuable learning document I have ever produced.`
  },
  {
    oldSlug: 'meilisearch-indeks-pantas-tukuk-os',
    title: 'Meilisearch: From a Hand-Built Index to a Fast Production Engine',
    slug: 'meilisearch-fast-indexing-for-tukuk-os',
    tags: ['Meilisearch', 'Search Engines', 'Infrastructure'],
    excerpt: 'Why I chose Meilisearch for Tukuk-OS, how I tuned it, and lessons from running an index live in production.',
    content: `After building an inverted index by hand I knew exactly what I needed: fast search, typo tolerance, faceted filtering, and minimal administration. Meilisearch met that list in a way nothing else I tested could, and the decision to use it turned Tukuk-OS from a personal project into a system that runs 24 hours a day.

### Why Meilisearch, Not the Alternatives?

I tested several options. Heavy options required a JVM or multi-node configuration beyond my small server's ability. Lightweight options did not support faceted search or autocomplete.

Meilisearch gave me three things I needed immediately: responses in milliseconds, filtering during search (language, site, type), and autocomplete. It also runs as a single process with reasonable memory usage — perfect for a server sharing resources with a web application.

### How I Tuned the Index

Tukuk-OS's main index, \`halaman_web\`, has \`searchableAttributes\` ordered by priority: title, headings, description, content, keywords, site name, and path. That order is not random — a match in the title outranks a match in body text.

\`filterableAttributes\` define what can be filtered in the UI: \`host\`, \`lang\`, \`type\`, \`section\`, \`siteName\`, and more. When I added a new \`siteName\` field the "Publisher" filter link appeared with no extra work. I learned that index design is really UI design — decisions I make in the backend immediately shape what users can do in the frontend.

### Measuring Search Quality with Reference Queries

Tuning index settings without measurement is guessing in the dark. I set a list of about twenty reference queries — a mix of popular searches, long-tail queries, and deliberately challenging ones — and run it every time I change configuration.

Each query is rated on three simple criteria: is the top result genuinely relevant, are the relevant filters available, and does response time stay below the threshold. When I add a new \`filterableAttributes\` field I expect filters to appear without slowing search down. If it slows search down I have to weigh whether the filter is worth it.

This approach prevents me from getting stuck optimising numbers that do not matter. A higher average score means nothing if your most popular query gets worse. With a reference set, a bad change shows itself within seconds and I can roll it back before it reaches users.

One extra lesson: keep the list in a portable text file, not in your memory. When I need to remember why a setting was chosen six months ago, the reference list and the notes beside it save hours of guessing.

### Managing a Live Index

The most important thing I learned about Meilisearch in production is how to handle updates. If I update the index live, users see half-finished results during the swap. My solution is simple: batch new documents, keep the old index until the new one is ready, then swap.

I also set \`displayedAttributes\` so internal fields are never sent to clients. This not only saves bandwidth, it prevents internal fields like internal scores from leaking into API responses.

### Backups: The Part Nobody Likes to Do

A Meilisearch index can be rebuilt from source, but rebuilding takes time and can fail if the source has changed. I wrote an export script that saves the index to a gzip file every few hours to Cloudflare R2. The script is about twenty lines, but it buys me immeasurable peace of mind.

The most important test I ran was not a successful backup — it was a successful restore. I deliberately deleted an index in a testing environment and restored it. After that I knew the procedure actually worked, not just that it looked like it worked.

### When Meilisearch Is Not Enough

Meilisearch solves text search, but Tukuk-OS needs more: image and video search requires external sources, autocomplete for new queries requires custom logic, and different scoring for blog posts versus link pages requires adjustment.

I decided not to force Meilisearch to do everything. Instead I built a layer around it: result scoring, media source aggregation, and filter management. The separation makes my system easy to maintain — each component does one thing well.

### Advice for Users

If you are starting a search project, begin with Meilisearch and do not build your own system too early. Spend your time on index design: what can be filtered, what can be searched, and what should be displayed. Those decisions will outlive any framework choice, and they determine whether your product feels smart or ordinary.`
  },
  {
    oldSlug: 'crawler-pertama-saya',
    title: 'My First Crawler: The Spider That Collected the World',
    slug: 'my-first-web-crawler',
    tags: ['Web Crawling', 'Search Engines', 'Scraping'],
    excerpt: 'Building a web crawler of my own: from blindly following links to respecting robots.txt, handling heavy pages, and avoiding becoming a burden to others.',
    content: `The crawler is the part of a search engine I feared most before building one. It sounds aggressive — a bot visiting other people's sites and copying content. But after building my first crawler I understood it is the most courteous work in the whole system: not collecting everything, but collecting properly and responsibly.

### The Basic Framework: Follow Links, Do Not Forget

The simplest crawler is a queue and a set. Take a seed URL, fetch the page, extract links, add unseen ones, repeat. The structure seems simple until you notice several obstacles:

- The same page can be reached through dozens of URL variants.
- Links can take you outside the site you were exploring.
- Some sites' pages contain thousands of links (calendars, archives).

My solution was to normalise URLs (drop \`www\`, unify \`https\`, strip tracking parameters), limit depth, and filter domains. Filtering \`utm_\` tracking parameters alone prevented hundreds of duplicates from entering my index.

### Respecting robots.txt: Not Optional

My first crawler did not read \`robots.txt\`. I noticed something odd when I looked at the logs and realised I had accessed an \`/admin\` section that a site explicitly forbade. I stopped the service, wrote robots.txt handling into my crawler, and added a courteous crawl delay.

Since then the Tukuk-OS crawler reads \`robots.txt\` before requesting any page, honours \`Disallow\`, and limits request rates to a reasonable number per domain. This is not just ethics; it is responsibility. Other people's servers have real users waiting, and I do not want to be the reason they slow down.

### Extraction: Finding the Needle

After downloading a page the real challenge begins: separating content from junk. Ads, scripts, navigation, and widgets fill most of HTML. I wrote an extractor that prefers \`<article>\` and \`<main>\`, then falls back to the body, and removes script, style, nav, and footer elements.

I also extract metadata: title, description, keywords, OpenGraph, publication date, and site name. That metadata then becomes the filterable fields in the Tukuk-OS index — when users filter by "Publisher" or "Language", it is this extraction work that makes it possible.

### Handling Variety in Page Formats

Every site is designed differently, and my crawler has to pull useful content out of all of them. I wrote a tiered detector: first look for \`<article>\` or a main element, then fall back to \`<main>\`, then to the whole body with navigation stripped out.

I also handle pages with almost no text — image galleries, video pages, short link lists. Instead of discarding them I extract what exists (title, description, outgoing links) and tag them with a suitable type so they remain searchable without dominating results for queries that ask for deep content.

What surprised me most is how much real content hides in nearly identical templates. Hundreds of blogs across millions of pages use two or three common themes, so once I wrote extractors for a few popular themes, extraction quality improved dramatically without needing per-site rules.

I also learned to respect time: some pages take seconds to fully load because they run many scripts. Instead of waiting I set a limit and use the raw HTML text — because on most pages the actual content does exist in the HTML rather than being generated by scripts.

### Managing Scale Honestly

At first I tried to crawl too much too fast. My server began running out of memory, and some sites started rejecting my requests. I learned three rules: limit concurrent interfaces, keep state so a restart does not start from zero, and log every decision so I can see problem patterns.

I also learned to value: not all pages are worth the same. Pages with reasonable content length, recent updates, and a good number of inbound links are worth more than navigation listings. This ranking stage reduced how many pages I had to store without reducing index quality.

### When Content Changes or Disappears

Pages die, move, or change content. I added periodic rechecks for already-indexed pages, then update or remove them. This process — known as index maintenance — I never thought about before building a crawler, but it takes as much time as collecting new content.

Recovery matters too. When I reran an index from scratch after corruption, I wanted my seed list and crawl state stored in a human-readable format. Designing for emergencies from day one saved me hours later.

### The Lesson

Building a crawler taught me to be polite at scale. The web is a shared space, and how you navigate it reflects who you are as a builder. Tukuk-OS crawls gently, respects limits, and stores only what is needed to help people find information. That is the idea behind a good search engine: serve users, never exploit other people's servers.`
  },
  {
    oldSlug: 'cloudflare-tunnel-tukuk-org-percuma',
    title: 'Cloudflare Tunnel and a Free Domain: Tukuk-OS Goes Live',
    slug: 'cloudflare-tunnel-and-a-free-domain',
    tags: ['Cloudflare', 'Domains', 'Hosting'],
    excerpt: 'How a server at home finally became reachable at tukuk.org without opening ports, without a static IP, and without a big monthly hosting bill.',
    content: `My web server ran fine on an old computer at home, but it was only reachable on the local network. To share it with the world I had to solve two problems: a memorable address (a domain) and a way to bring traffic in without opening a hole in my firewall. Cloudflare Tunnel solved both, and the combination became the tukuk.org you visit today.

### The Problem With the Traditional Way

The old way to host your own server is to buy a domain, point an A record at your home's public IP, and open ports 80 and 443 on your router. I tried it, and it failed at every step: my home IP changed, my internet provider blocked certain ports, and opening ports meant I had to keep my server's security perfect every single time.

My biggest fear was not being targeted — it was not knowing what I did not know. One wrong configuration and my private server could become part of a botnet. I wanted minimal exposure.

### What Is a Cloudflare Tunnel?

A Cloudflare Tunnel runs a small agent on your server that reaches out to Cloudflare's network, rather than allowing inbound connections. No port is opened on the router, no IP needs updating, and traffic is encrypted the whole way.

When I ran \`cloudflared\` for the first time and received a temporary URL, I opened it on my phone outside the local network and saw my server. That feeling — seeing your work accessed from the outside world without opening a single port — was one of the most satisfying moments of this journey.

### Setting Up tukuk.org

Once the tunnel worked I added my own domain. The steps: add the domain to a Cloudflare account, let Cloudflare manage DNS, then point a hostname at \`tukuk.org\` and subdomains like \`www\`. Within minutes \`https://tukuk.org\` was serving the server at my home, complete with automatic HTTPS certificates.

What I learned: DNS is a layered trust system. MX records for email, SPF to verify senders, DMARC to protect your domain name from being forged — all must be aligned. A small mistake in one record can put your email in spam folders for weeks.

### Subdomains and Service Separation

Once the tunnel worked I decided to separate services with different subdomains. The main application server lives at \`tukuk.org\`, while supporting services like the indexer and background search workers stay on local ports that are never exposed to the public.

This separation gave me three advantages. First, security: only one service touches the internet, so I only maintain one attack surface. Second, changeability: I can restart background services without touching pages users see. Third, clarity: when something fails, the tunnel location tells me immediately which service is broken.

I also learned the value of a hidden \`robots.txt\` and a \`health\` page. \`robots.txt\` stops bots from wasting time indexing utilities, while \`/health\` gives a monitoring agent one simple URL that returns the system's true status. Two small files prevented a lot of confusion later.

When I add a new service the rule stays the same: if the public does not need to reach it, it gets no subdomain and opens no port. Expose as little as possible — that principle governs the entire Tukuk-OS network configuration.

### Security: Layers I Added

With a public domain I added several layers: \`robots.txt\` to tell bots what may be accessed, rate limiting to prevent abuse, and basic monitoring. I also keep secrets in an \`.env\` file that never enters the git repository — a lesson I learned early before it became a problem.

I also decided not to expose Meilisearch (port 7700) to the internet at all. Only the application server talks to it over localhost. One simple rule — expose as little as possible — dramatically reduced my attack surface.

### Cost and Limitations

I avoided big monthly bills, but I still have costs: an annual domain, and my time to maintain it. The tunnel itself is free for my needs. When traffic grows I will evaluate when to move to more solid hosting, and when a home server is still enough.

The biggest lesson: hosting is not a question of "expensive or cheap" but of "exposure and control". Cloudflare Tunnel gave me full control of my stack with minimal exposure to the internet — the combination I had been looking for since the day my server first came alive under a bed.`
  },
  {
    oldSlug: 'tukuk-os-hidup-refleksi',
    title: 'Tukuk-OS Is Alive: Reflections From Broken Laptop to Working Search Engine',
    slug: 'tukuk-os-is-alive-reflections',
    tags: ['Story', 'Reflections', 'Tukuk-OS'],
    excerpt: 'An honest reflection after Tukuk-OS started working: what was hardest, what I would do differently, and what keeps me writing code.',
    content: `One night I opened tukuk.org from my phone outside the house, typed a question, and watched results appear within a few dozen milliseconds. Right then I remembered the laptop that died years ago — the flickering screen, the fan growing quieter, and the despair of losing my only learning tool.

### Why I Started

I did not start with the goal of building a search engine. I started with the goal of **never stopping learning**. Every step — Linux, HTML, JavaScript, Node.js — was completed because I wanted to see one more result tomorrow. When those steps began to add up, I realised I had the skills to build something bigger than a tutorial.

Tukuk-OS was not an idea I planned from day one. It was born out of frustration: other search engines felt too full of ads, too much tracking, and too few answers. I wanted search that was simple, honest, and mine.

### The Hardest Part

Honestly, the hardest part was not writing code. It was **maintenance**. A server running 24 hours needs logs, backups, monitoring, and a plan for when everything fails at three in the morning.

I once had a night where the NASA API failed, the browser showed broken images, and the contact form stopped sending email — all at the same time. That night taught me to build systems that fail gracefully: honest error messages, retry buttons, and fallbacks that kick in automatically.

### What I Would Do Differently

If I started over, I would write tests first. At first I relied on "manual testing in the browser", which worked until I had too many routes to remember. Automated testing changed how I add new features: I can now add a route and know confidently that old routes are not broken.

I would also write blog content from the start. I put off writing until the system was ready, while actually writing helps me think about the system more clearly. Writing about what I build exposes weaknesses I did not notice while writing the code.

### What Stays

Three things I will not give up:

1. **Honesty in errors.** When an external service fails I tell the user. No deception, no confusing blank screens.
2. **Trust in open data.** NASA, USGS, the World Bank — open data makes Tukuk-OS meaningful without selling anyone's information.
3. **Ownership.** My code, my domain, my index, my backups. The freedom to change, shut down, or rebuild any time is the real motivation behind this project.

### What Comes Next for Tukuk-OS

A good search engine is never really finished. My backlog is long, and I list it here not as a promise but as a principle: every improvement must make search more useful or the system more resilient, not merely add features.

Among the near-term plans is improving Malay-language coverage in the index — most of my sources are English today, and Malay readers deserve equally good results in their own language. I also want to add advanced search modes: exact phrase matching, term exclusion, and finer date filtering.

On the infrastructure side I want to move monitoring beyond a simple liveness check to real metrics — p95 response time, error rate, and result counts — so I can see slow degradation before it becomes a visible problem. And I want to test restore procedures regularly, because an untested backup is just hope stored in gzip format.

What I look forward to most, however, is content. A search engine without valuable content is an empty pipe. Every new article, every snippet improvement, and every added data source makes that pipe more useful to the people who rely on it.

### If You Are Just Starting

My advice: do not wait for a new laptop, faster internet, or a perfect mood. Start with one empty file today. Learn one command. Write one page. Hook it up to a server. Repeat tomorrow.

The journey from a broken laptop to a living search engine is not a story about talent. It is a story about consistency — line by line, day by day — until one day you open your work from your phone and realise you have arrived. And the most exciting part: you can keep building from here.`
  }
];
