module.exports = [
  {
    oldSlug: 'kenali-tukuk-os',
    title: 'What Is Tukuk-OS? What This Search Engine Actually Does',
    slug: 'what-is-tukuk-os',
    tags: ['Tukuk-OS', 'Search Engines', 'Introduction'],
    excerpt: 'A full overview of Tukuk-OS: what it does, how it differs from other search engines, and why it is built on a free, open source stack.',
    content: `Tukuk-OS is a web search engine I built myself, starting on one old computer at home and now reachable at tukuk.org. It indexes websites, offers image and video search, displays live NASA space data, and provides a blogging platform — all in one lightweight application with no user tracking.

### What Tukuk-OS Is Not

Before explaining what it does, it matters to state what it is **not**. It is not a global-scale engine indexing billions of pages every day. It is not a replacement for Google on every query. And it is not a service that sells user data — because no user data is collected to sell.

Tukuk-OS is a **focused, restrained** search engine: a curated set of sources, high result quality for the topics it covers, and full respect for privacy. It was built to help people find answers, not to exploit their attention.

### A Simple Architecture

Under the hood, Tukuk-OS is a Node.js/Express application that talks to Meilisearch for text search. The server exposes APIs under \`/api\` and \`/search\`, while the browser presents the interface. All static files — pages, themes, scripts — are served from the \`public\` directory.

This design is deliberately small. One process, one server, one index. When something fails it is easy to know where: the server log tells you within minutes. Large, complex projects take weeks to diagnose; Tukuk-OS takes minutes.

### Headline Features

- **Standard web search** with snippets, language and site filters, and scoring that prefers matches in titles.
- **Image and video search** from external sources with result pagination and a "load more" button.
- **NASA data**: the daily picture (APOD), near-Earth asteroids, Earth views from EPIC, sounds of space, and NASA media search.
- **A technical blog** with original content, quality benchmarks, and structured data for search engines.
- **A contact form** that sends real email through Cloudflare Email Routing.

### An Honest Comparison With Other Engines

It is fair to state where Tukuk-OS wins and where it loses. Compared to global search engines, Tukuk-OS is far smaller in coverage — it does not have billions of pages, and it does not track you to personalise results. If you are looking for breaking news or something very niche, a bigger engine may give you more results.

Where Tukuk-OS wins is focus and transparency. Snippets come straight from the target page, filters are clear and work instantly, and results are not influenced by whoever pays to appear. NASA pages, technical blogs, and media search all live in one place without switching between several services.

The design philosophy is also different: missing features are features. No weather widget, no news feed, no experience designed to keep you inside the app. You come, you search, you get answers, you leave — and to me that is how a search engine should behave.

### Data Sources and Ethics

Much of Tukuk-OS's value comes from open sources. NASA opens almost all of its data to anyone, and Tukuk-OS takes full advantage of that permission. For image and video search I send requests to public providers and cap request rates so nobody gets an excessive load.

My crawler also reads \`robots.txt\` for every site before it walks, honouring restrictions and rate limits. A good search engine should be a courteous guest on other people's web.

### The Cost Model

Tukuk-OS runs on open source software (Ubuntu, Node.js, Meilisearch) on hardware I already own. The real cost is just the annual domain and maintenance time. There is no monthly server bill because it is self-hosted, and traffic flows through a Cloudflare Tunnel without opening any port on my router.

This model is not right for every project, but for a personal search engine at moderate scale it produces near-zero cost with total control.

### Who Should Use It

If you want search that is simple, free of intrusive ads, and honest about what lives on the target page, Tukuk-OS is for you. If you need minute-by-minute news coverage you may need a bigger engine — and that is fine.

Most importantly, Tukuk-OS is proof that you can build a search engine yourself today without large capital, without a team, and without selling anyone's privacy. Everything I use to build and run it is free or nearly free, and every design decision is explained on this blog.`
  },
  {
    oldSlug: 'ciri-lengkap-tukuk-os',
    title: 'Tukuk-OS Complete Feature Tour: From Web Search to Space Data',
    slug: 'tukuk-os-complete-feature-tour',
    tags: ['Tukuk-OS', 'Features', 'Search'],
    excerpt: 'A detailed list of every Tukuk-OS feature: search, filters, autocomplete, image and video results, daily NASA data, and the blog — and how they connect.',
    content: `Tukuk-OS looks simple on the surface, but behind the search box are dozens of small features built over years. This article opens each one so you know what you can ask of this system.

### Web Search With Full Filtering

When you type a query, Tukuk-OS sends it to Meilisearch, which searches our \`halaman_web\` index. Results are ordered by a relevance score that prefers matches in titles, then headings, then body text.

Once results appear you can filter by:

- **Language** (en, ms, etc.) — determined during crawling.
- **Domain / publisher** — to narrow to sources you trust.
- **Content type** — articles, documentation, forums, and more.

These filters work because the right fields were defined in the index from the start. Adding just a new \`siteName\` field is enough for the "Publisher" link to appear in the UI with no client work.

### Suggestions and Autocomplete

As you type, \`/suggest\` returns page titles close to your query. Click any suggestion and the search box fills instantly. This feature looks small, but it reduces typos and helps users find more specific pages than they initially had in mind.

### Image and Video Search

The Images and Videos tabs are not just another display — they are a separate source aggregation. Images come from a major image engine with page support (page 1, page 2, and so on), while videos come from YouTube including duration, channel, and view counts.

Every image result shows the title, the original source, and a link to the original page — so credit always goes back to the creator. The "load more" button calls the same endpoint with a new page parameter, so you can keep scrolling without reloading.

### Mobile Experience and Shortcuts

More than half of Tukuk-OS visitors open the site from a phone, so mobile design is not an addition — it is the primary design. The search box fills the screen, media tabs switch with one tap, and the image grid uses three columns on small screens so you can thumb through results without losing your place.

I also added a few keyboard shortcuts for desktop users: focus the search box with \`/\`, and navigate results with the arrow keys. Shortcuts look minor, but for frequent searchers they shorten every search by a few seconds — accumulated over a day that is a noticeable saving.

Another design decision I am proud of: search results are preserved when you switch between Web, Images, and Videos. Your query does not vanish and you never retype it. It sounds basic, but many search engines clear your query when you change modes — something I learned not to do.

### Live NASA Data

The NASA page is a space data hub:

- **APOD** — Astronomy Picture of the Day, with a full explanation and automatic fallback when the NASA API fails.
- **Asteroids** — near-Earth objects with their size and distance.
- **EPIC** — images of Earth taken from the L1 point between Earth and the Sun.
- **Sounds of Space** — real sounds from space missions, playable right there.
- **History & Topics** — a timeline of NASA milestones and topic exploration.

All of this data comes straight from NASA unmodified, so it is always accurate and current.

### Blog and Content

The Tukuk-OS blog stores technical articles in the local database, renders them through \`renderMarkdown\`, and serves them with BlogPosting structured data for search engines. Every article has a title, slug, excerpt, tags, date, and author — and the list is ordered newest first.

### The Infrastructure Behind It All

Three things make the features above dependable:

1. **Automatic backups** to Cloudflare R2 every few hours.
2. **A watchdog** that restarts the service if it fails.
3. **A circuit breaker** for external services so NASA or image provider failures never slow the site.

These are invisible in the UI, but without them the other features would feel fragile. That is the Tukuk-OS design philosophy: users only see the fast and stable parts, because the hard work happens behind the curtain.

If you have not explored all of this yet, start with the NASA tab, then try image search on your favourite topic, and finally read through the blog. You may be surprised how much one small server can do.`
  },
  {
    oldSlug: 'carian-imej-dan-video-tukuk-os',
    title: 'Image and Video Search in Tukuk-OS: How It Actually Works',
    slug: 'image-and-video-search-in-tukuk-os',
    tags: ['Tukuk-OS', 'Image Search', 'Video Search', 'Scraping'],
    excerpt: 'Inside the mechanics of the Images and Videos tabs: sources, request flow, extraction, error handling, and the pagination strategy.',
    content: `When you open the Images tab in Tukuk-OS and watch a grid of pictures appear, a fairly interesting chain of requests is happening behind it. This article opens that black box — how pictures and videos are searched, extracted, and served quickly.

### There Is No Image Index of Our Own (And Why)

Unlike text search, which uses our own Meilisearch index, image and video search runs **live** (on demand) when you click the tab. That means results are always fresh, but it also means we depend on external providers to respond.

This choice was made because indexing millions of images ourselves would require storage, bandwidth, and licensing that are unrealistic for a personal project. By requesting results live, Tukuk-OS brings fresh data without permanently storing other people's content.

### The Request Flow for Images

When you open the Images tab the browser sends \`GET /images?q=...&page=1\`:

1. The server normalises the query (trim, clean, cap length).
2. If a cache entry exists for that query and page it is returned instantly.
3. Otherwise the server sends a request to the image provider with normal browser headers (so a plain HTML response is accepted).
4. The HTML response is parsed: each result carries a main image, a thumbnail, a title, and a source link.
5. Invalid results (no image URL, or only a default logo) are **discarded** before being sent to you.

Step 4 matters. At one point a broken response from the provider filled the grid with the same image repeated over and over. After I added that validation the grid stays clean even when a source sends partial data.

### Pagination

The first page returns about thirty-five images. When you scroll down and click "load more", the server calls the same source with a new page parameter — the offset changes, and new images are appended to the grid **without removing the existing ones**.

The cache key includes the page number, so page 1 and page 2 never mix. Weak results (fewer than a handful of valid hits) are not cached at all, because a cache poisoned with broken data would ruin every subsequent search for that query.

### The Request Flow for Videos

Videos are fetched from YouTube with a different approach: the server requests the YouTube search page, then locates an embedded JSON data block in the HTML (rather than scraping HTML nodes raw). That block contains video information in a tree structure.

The server then walks the tree and extracts: video title, URL, thumbnail, channel name, duration, and view counts. Joining that metadata ensures every video card shows "channel · views · duration" without duplicated information.

YouTube also returns a **continuation token** for the next batch of results. The token is stored alongside the results and sent back when you click "load more", enabling a seamless continuation without regenerating the search query.

### Respecting Content Creators

Image search has a serious ethics issue: most pictures on the internet have creators, and search engines have a responsibility not to steal them. Tukuk-OS's approach is to be a **conduit, not a vault**: we show a preview, but the primary link takes you to the original page where the image was published.

We do not store copies of images in our own storage — previews are fetched from the source every time they are displayed. This means creators still get visits and traffic when you click, and we do not become an unlawful archive of other people's work.

For video the principle is the same: results show title, channel, and duration, but links take you to the original platform where the creator earns the view. We also avoid extracting or storing the video file itself — all we carry is information to help you find it.

These simple rules may seem like limiting the product, but they actually protect us and make results more useful: you always know where the true source lives, and you can always go there for full context, credit, and information.

### Handling Failures Gracefully

When an external provider fails (network issues, blocking, or their own errors) the endpoint returns an empty list with an honest error message, not a confusing error page. The UI then shows a "no results" message and retries when you click the provided button.

Failure states are never cached — only successful results. This prevents a temporary failure from becoming the "official answer" for that query.

### Honest Limitations

Because we rely on external sources, some queries may return different results from time to time, and some regions may be blocked by the provider. Tukuk-OS does not promise universal coverage — it promises that when results are shown they are valid, come from honest sources, and can be traced back to the original page.`
  },
  {
    oldSlug: 'sistem-blog-tukuk-os',
    title: 'The Tukuk-OS Blogging System: How Content Is Written, Stored and Served',
    slug: 'the-tukuk-os-blogging-system',
    tags: ['Tukuk-OS', 'Blogging', 'Markdown', 'CMS'],
    excerpt: 'Not just an article list — the story behind Tukuk-OS’s simple blog system: JSON storage, a Markdown parser, a dynamic sitemap, and steady content standards.',
    content: `The blog you are reading is not WordPress or an off-the-shelf platform — it was written specifically for Tukuk-OS. That choice saved cost, reduced the attack surface, and let me define exactly the content shape I wanted. Here is how the system works from editing to publishing.

### Storage: Honest JSON

Articles live in one JSON file (\`data/tukuk-os.json\`) as an array of objects, each with \`title\`, \`slug\`, \`author\`, \`tags\`, \`excerpt\`, \`content\`, \`createdAt\`, and \`updatedAt\`.

At first I worried about single-file performance, but the number of blog articles (dozens, not hundreds of thousands) is far below the point where it becomes a problem. The server keeps data in memory and writes back on a delay, so reads never wait on disk.

The unexpected advantage: a JSON file can be eyeballed, hand-edited in an emergency, and fed into an existing backup pipeline with no extra database tooling. When my server crashed one night I fixed one record with a text editor in three minutes.

### Editing: A Script, Not a Panel

I write articles in special JavaScript files containing arrays of article objects, then run a seed script to insert them into storage. The script adds new articles and updates fields that change — for example, standardising the author name across the archive.

This approach suits me because it works anywhere (including over SSH from a phone), can be reviewed in version control, and requires no admin web panel to secure.

### A Small Markdown Parser

When an article page opens, the \`content\` passes through \`renderMarkdown\` — a function that turns \`##\` into headings, lists into \`<ul>\`, bold text into \`<strong>\`, plus links, code spans, and paragraphs.

This parser is not full CommonMark, and that is deliberate. It supports the subset I use in writing, produces clean HTML with no stray styles, and is impossible to exploit because it takes content I wrote myself. That one decision removes an entire class of complexity (and risk) that third-party content editors bring.

### Publishing and Distribution

Every time the article list grows it appears automatically:

- On the \`/blog\` list, newest first.
- In the dynamic XML sitemap (\`/sitemap.xml\`) with correct \`<lastmod>\`.
- In feeds and other internal links with no extra work.

The sitemap is built dynamically from stored data — not a static file that needs regeneration — so a new article appears in the sitemap within seconds of being saved.

### Quality: The 650–850 Word Standard

Every article targets between 650 and 850 words: deep enough to be useful, short enough to finish reading. The seed script counts words and warns if an article falls outside the range.

I also have personal writing rules: one main idea per article, at least three headings, real examples from real projects, and no filler. If I cannot explain something without jargon, it means I have not understood it well enough.

### What Makes an Article Ready to Publish

Before saving, every article passes a short checklist. First, does it answer a question real people actually ask? Second, does it contain concrete examples from projects I actually worked on? Third, can a newcomer follow it without prior knowledge? Fourth, is the title honest — does it promise exactly what the piece delivers? Fifth, does it link to at least one other page on this site?

A sixth check happens after the draft is "finished": I read it aloud. Any sentence that makes me stumble while reading is rewritten, because a sentence that is hard to say aloud is usually hard to follow on a screen. This single habit catches more awkward phrasing than any automated tool I have tried.

That checklist takes about ten minutes per article and is why this archive stays consistent even as my writing style evolves. The rules are deliberately small — the moment a quality process becomes bureaucratic, people (including me) start skipping it.

### What Comes Next

The roadmap includes an official RSS feed, smarter ranking for the blog list, and possibly layered categories. But the core principles will stay: content is data, storage must be easy to recover, and the system must stay small until it genuinely needs to grow.`
  }
];
