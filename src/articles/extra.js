module.exports = [
  {
    oldSlug: 'kenapa-saya-pilih-nodejs-dan-express',
    title: 'Why I Chose Node.js and Express for Tukuk-OS',
    slug: 'why-i-chose-nodejs-and-express',
    tags: ['Node.js', 'Express', 'Architecture', 'Tukuk-OS'],
    excerpt: 'An honest comparison of backend stacks: why Node.js/Express beat Python, PHP and heavy frameworks for a personal search engine project.',
    content: `Every software project starts with the same question: what should I use? For Tukuk-OS the answer was Node.js with Express — and even though the choice looks obvious today, it was not necessarily so on day one. Here is the real reasoning behind that decision.

### First Consideration: One Language

I already knew JavaScript from frontend work. If I had chosen Python or PHP I would have had to learn new syntax, a new package ecosystem, new deployment methods, and new error handling — all while trying to understand search and crawlers.

With Node.js I only had to learn **new things within the domain itself**: HTTP, indexes, and API calls. The language, the tools, and the mindset stayed the same. In a small project this context saving is equivalent to weeks of real time.

### Second Consideration: Fast to Start

Node.js starts in seconds. \`node server.js\` and the server is alive. No heavy control panel, no build pipeline, no configuration explainers. Express adds clear structure: routes, middleware, error handling — all with syntax that reads like a sentence.

Startup speed is not a luxury; it decides whether you finish a feature in the evening or postpone it to tomorrow.

### Third Consideration: The Event Loop

Search engines do a lot of waiting work: waiting for external API responses, waiting for disk, waiting for Meilisearch. Node.js's event loop suits this pattern — hundreds of pending requests can be served by one process without starting a new thread for each.

For Tukuk-OS this means a small server can handle concurrent search requests without eating all memory. When you click the Images tab and it calls several external providers at once, this model is what is working.

### What I Gave Up

Every choice has a cost. Node.js is less suited to heavy CPU work like large-scale image processing (because one JavaScript process blocks the others). I solve it by simply not doing such work — or, if necessary, delegating it to a specialised tool.

I also lost Python's rich scientific library ecosystem, but a search engine does not need it. What I do need — HTTP bindings, parsers, search clients, loggers — all exist and are mature in Node.

### Express: Deliberately Simple

The design decision I value most is **not using a heavy framework**. Express gives me routes and middleware without dictating how my project must be organised. I can structure files as I like, export functions directly, and add a new route without facing layers of abstraction.

Larger frameworks give you more business features, but they also bring more conventions to learn and follow. For a personal project where I am the only builder, freedom is worth more than imposed structure.

### Dependency Management

A fair concern about modern stacks is the number of third-party packages. Node.js has a huge ecosystem, and it is easy to pull in twenty dependencies for what looks like a simple task — meaning more code that is not yours that you must trust and update.

My approach: dependencies only if they solve a genuinely hard problem, and as few as possible. I use Express for the server (mature, widely used, transparent), small libraries for specific tasks, and I avoid "meta" frameworks that bring their own way of doing almost everything.

I also run dependency checks regularly to catch packages that are no longer maintained or have known security issues. Dead packages get replaced or, if small, replaced with a few lines of my own code. The principle is simple: every dependency is a promise of future maintenance, and you should only make promises you are willing to keep.

The number of direct Tukuk-OS dependencies stays in the low double digits, and that is no accident. Every package I add must justify itself by solving something genuinely hard or something that would take days to rewrite properly. By keeping that list short, maintenance time stays focused on code that actually belongs to this project.

### What I Would Choose Now

If I started again I might still choose Node.js and Express — but with more testing from the start, because confidence gained from automated tests is something no stack choice provides.

My advice: pick a language you already know, the smallest framework that suffices, and do not let the search for a perfect stack delay the actual building. The best search engine ever built started with a server that only displayed text.`
  },
  {
    oldSlug: 'caching-strategi-dan-pemutus-litar',
    title: 'Caching Strategy and Circuit Breakers: Keeping Tukuk-OS Fast and Stable',
    slug: 'caching-strategy-and-circuit-breakers',
    tags: ['Caching', 'Reliability', 'Performance', 'Tukuk-OS'],
    excerpt: 'Two techniques that turned Tukuk-OS from a frequently slow site into a fast one even when external services fail: query-keyed caching and circuit breakers.',
    content: `Every search engine depends on external services, and every external service will fail at an unexpected moment. Tukuk-OS handles this fact with two simple but powerful techniques: carefully planned caching, and a circuit breaker that stops failures from spreading.

### Cache: Why Same, How Fresh

The Tukuk-OS cache is organised by **query and parameters**, not time alone. The cache key contains the query, the page, and the media type — so "nasa" page 1 and page 2 never mix.

But the most important part is the rule about what is **not** stored. Weak results (too few hits) and failures **never enter the cache**. If I stored failed results, a temporary problem would become the "official answer" for that query for the whole cache duration — a mistake I learned about the hard way when my image grid showed a single result for several minutes.

Time-to-live matters too: text search results can live longer because the index only changes when I update it, while daily NASA data has a short life because it changes every day.

### How I Know the Cache Works

Like any optimisation, a cache is only worth it if the effect can be measured. I installed simple response-time logging: every request records whether it was served from cache or from source, and how long it took.

After a few weeks of data two things became clear. First, most search queries repeat within a short window — when a topic trends, hundreds of people type variations of the same query within hours, and all of them are served in milliseconds from cache. Second, a well-designed cache reduces not only user latency but also load on external services — which in turn reduces the risk of being blocked for excessive requests.

I also track the **hit rate**: the share of requests served from cache. When that rate drops sharply it usually signals a change in query shape (perhaps a new feature) rather than a problem — and it tells me to review my key generation strategy.

The metric that matters most, however, remains the simplest: does the page feel fast to the reader? All other numbers are proxies for that answer. When there is a conflict between numbers and user perception I always trust user perception — because ultimately the cache exists for them, not for a dashboard that only I see each morning.

### The Circuit Breaker: Three States

A circuit breaker has three states:

1. **CLOSED** — all requests pass through to the external service as normal.
2. **OPEN** — the external service has failed repeatedly; requests are rejected immediately and the fallback answer is used without waiting.
3. **HALF-OPEN** — after a cool-down period, a few trial requests are allowed to see whether the service has recovered.

In Tukuk-OS this is applied to the NASA APOD call. When NASA has an outage (which happens more often than you would think), the first request might take ten seconds before failing; the second records the failure; the third opens the circuit. From then on every client gets the fallback instantly — no more timeouts for every visitor.

### What Users See

The UX key: when data comes from cache or a fallback, users are **told**. The APOD display shows a "data may be delayed" warning with a retry button instead of pretending everything is normal.

This honesty beats silence. Users are more understanding and more patient when they know what is happening, and the retry button gives them control to try again when they want.

### What I Do Not Cache

I do not cache contact form submissions (rare and critical), do not cache private responses (there are no private users to store), and do not cache static pages at the application layer because Cloudflare already does that more efficiently at the edge.

The main point: caching is not "cache everything". Every cache decision must weigh speed against the risk of serving stale data.

### The Lesson

If you build anything that calls external services, start with two rules: never store failures, and never let a third party's failure slow you down. Both look small in code, but they determine whether your service feels solid or fragile to anyone who uses it.`
  },
  {
    oldSlug: 'adsense-blog-kecil-panduan-jujur',
    title: 'AdSense for Small Blogs: An Honest Guide From Real Experience',
    slug: 'adsense-for-small-blogs-an-honest-guide',
    tags: ['AdSense', 'Revenue', 'Blogging', 'Monetisation'],
    excerpt: 'Real experience installing Google AdSense on a small blog: what gets reviewed, where ad slots go, actual earnings, and when monetising makes sense.',
    content: `Many bloggers start with dreams of passive income. The reality of AdSense for a small blog is more modest, and this article writes real numbers and practical decisions — not promises — based on my own experience.

### Application and Approval

My AdSense application went through several rejections before being approved. The biggest issues were too little content and incomplete pages. After I added a privacy page, terms of service, an about page, a contact page, and several full articles, approval came quickly.

The lesson: AdSense reviews the **site**, not a single article. A site that looks complete — with clear navigation, original content, and policy pages — passes more easily than a collection of half-finished pages.

### Slot Placement That Works

I installed three slots: top, middle of content, and bottom. The middle-of-content slot earns the most because it sits where readers are actually reading, but it is also the one most likely to disrupt the reading experience.

The rule I set for myself: ads must not push content below the fold, must not cover text, and must not cause the page to shift while it is being read. If an ad interrupts reading, readers leave, and eventually revenue follows them.

### Metrics I Watch (And Which I Ignore)

After installing ads I set exactly three numbers to watch weekly: impressions, click-through rate (CTR), and revenue per thousand impressions (RPM). Those three tell the whole story — if impressions rise but revenue does not, traffic quality has changed; if CTR drops, placement may be disrupting reading.

What I deliberately ignore: daily numbers. AdSense revenue fluctuates day to day, and staring at daily swings only produces stress without actionable information. I review weekly and monthly data, which shows the real patterns.

I also compare revenue against actual operating costs each month. Seeing ads cover the domain and storage bill — even though the amount is small — gives honest context about what traffic is really worth, and stops me from making design decisions that are too dependent on monetisation.

### The Honest Reality of Numbers

For a small blog with traffic of a few hundred visits a month, expect a few dollars a month — not hundreds. Those figures grow with traffic, and traffic grows with content and SEO.

I decided to install ads early, before big traffic, for two reasons: to understand how the system actually works, and to cover small operating costs (domain and storage). For some bloggers, delaying ads until traffic is steady gives a cleaner reader experience during the critical early period — both approaches are reasonable.

### Common Mistakes by Small Bloggers

Watching other projects and my own mistakes, several patterns repeat. First: installing too many ads too early, which pushes content down and raises bounce rates. Second: chasing traffic from irrelevant sources — visit numbers rise for a week, then fall, and nobody returns because the content does not match their expectations.

The third and most expensive mistake: ignoring basic SEO because "I'll think about it once I have traffic". In reality SEO builds momentum from day one, and algorithms need time to trust a new site. A site that waits six months to start loses the most valuable window — when search engines are still learning your publishing habits.

A fourth common mistake: redesigning every month. Every change stops data from stabilising, so you never know whether the change helped or hurt. Change one thing, wait a few weeks, then evaluate — that is the routine I follow.

### Alternatives and Combinations

For a small blog ads are not the only path. Direct donations, digital products, and client work can all beat ads in revenue per visitor. I see AdSense as the lowest layer — it provides a little return without requiring direct sales — and I plan to add other layers as traffic allows.

### Practical Advice

If you are applying: finish the site first, write at least ten original articles, add a privacy policy and terms, then apply. After approval, start with a placement that does not disrupt reading, and watch results for a few weeks before adding more slots. Revenue comes from traffic, and traffic comes from valuable content — not the other way around.`
  },
  {
    oldSlug: 'seo-blog-baru-10-langkah-praktikal',
    title: 'SEO for New Blogs: 10 Practical Steps I Implemented on Tukuk-OS',
    slug: 'seo-for-new-blogs-10-practical-steps',
    tags: ['SEO', 'Blogging', 'Traffic', 'Guides'],
    excerpt: 'A real SEO checklist for a brand-new blog — from sitemaps, canonicals, and JSON-LD to Search Console registration and low-competition keyword choices.',
    content: `A new blog faces a hard situation: no backlinks, no authority, and an empty index. These 10 steps are the checklist I implemented myself for Tukuk-OS — not theory, but actions you can execute in your first few days.

### 1. A Correct XML Sitemap

A sitemap should be simple and complete. For Tukuk-OS \`/sitemap.xml\` is generated dynamically from storage, so every new article appears within seconds with a correct \`<lastmod>\`. I also mention the sitemap in \`robots.txt\` so bots find it without instructions.

### 2. A Clear robots.txt

My \`robots.txt\` allows all bots, blocks utility pages (like \`/health\`), and provides special rules for Googlebot and AdsBot. The most common mistake is accidentally blocking important resources — double-check after every change.

### 3. Canonical URLs

Every page carries a \`<link rel="canonical">\` pointing to the official URL version. This prevents duplicate-content problems when URL parameters create different versions of the same content.

### 4. Unique Titles and Descriptions for Every Page

Unique titles and rewritten meta descriptions affect whether people click from search results. I make sure every article has its own description, not the same template repeated over and over.

### 5. Structured Data (JSON-LD)

Tukuk-OS articles carry \`BlogPosting\` JSON-LD with headline, author, publication date, and publisher. This data lets search engines understand the page precisely and potentially show rich results in search listings.

### 6. One H1 per Page Structure

One main \`<h1>\`, then \`<h2>\` and \`<h3>\` for structure. Not just styling — heading structure helps both readers and bots understand the hierarchy of the content.

### 7. Long-Tail and Local-Language Content

This is the most important step for a new blog. Do not target "SEO" (impossible to win); target "how to submit a sitemap to Google Search Console" or "when does a small blog get traffic". In most languages outside English competition is far lower for many queries — and that is a new site's biggest advantage.

### 8. Register Google Search Console and Bing Webmaster

A sitemap that is never submitted may take a long time to be indexed. After registering, submit the sitemap and watch the indexing report to see which pages are accepted and which are rejected. Bing matters too because it supplies results to several other engines.

### 9. Deliberate Internal Links

Every article should link to other related articles. Internal links help bots discover new content and build topic hierarchy. On Tukuk-OS every article links back to the main blog, and the blog list acts as a natural internal hub.

### 10. Consistent Publishing

Finally, and most boringly: keep going. Search engines like regularly updated sites, and algorithms need time to trust a new site. One quality article a week for six months beats ten articles in one week followed by six months of silence.

### Free Tools to Monitor All Of It

Implementing 10 steps without monitoring is like installing a lamp without a switch — you will never know when it goes out. Three free tools cover most needs:

**Google Search Console** shows which pages are indexed, which keywords bring impressions, and whether there are crawl errors. The "position" report is the most valuable: it shows queries getting impressions in positions 8 to 20 — close, but not clicked yet. That is your best opportunity list: pages that almost win but need better titles or a bit more content.

**Bing Webmaster Tools** gives a similar picture for the Bing network, and it matters because several other search engines take their results from the same source. Registration takes a few minutes and submission is similar.

**Your own site analytics** (or simple log counts) tells you which pages are actually visited and how long people stay. Combining the three sources — impressions, positions, and real behaviour — gives a full picture of where your SEO effort pays off and where it is being wasted.

One warning: do not check these tools every day. Search data takes a few days to update, and daily swings only add anxiety without information. One check a week, at the same time, is enough for most sites.

### Realistic Expectations

The first week: almost no traffic while Google processes the index. Month two: some long-tail clicks may appear. Month three and beyond: traffic starts to grow if content keeps coming. SEO is not a switch — it is a garden that must be watered.`
  }
];
