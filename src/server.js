const express = require('express');
const cors = require('cors');
const compression = require('compression');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
const net = require('./net');
const store = require('./store');
const brain = require('./brain/provider');
const rag = require('./brain/rag');
const websearch = require('./brain/websearch');
const mediaSearch = require('./brain/media-search');
const news = require('./news');
const queries = require('./queries');
const answer = require('./answer');
const bingbot = require('./bingbot');
const { client, health } = require('./meili');
const crawler = require('./crawler');
const fallback = require('./fallback');
const nasa = require('./nasa');
const explore = require('./explore');
const { rateLimit, requireApiKey } = require('./middleware');
const { safeError, truncate } = require('./util');
const blogRedirects = require('./blog-redirects');

const index = client.index(config.indexName);

// Index korpus ujian yang boleh dipilih melalui ?index= pada /search.
// Indeks lain tidak dibenarkan supaya carian awam tidak boleh dialih sesuka hati.
const DEMO_INDEXES = new Set(['uji_coba']);

const START_TIME = Date.now();
let requestCount = 0;
let errorCount = 0;

const limiter = config.rateLimit.enabled
  ? {
      search: rateLimit({
        windowMs: config.rateLimit.searchWindowMs,
        max: config.rateLimit.searchMax,
        keyPrefix: 'search:'
      }),
      write: rateLimit({
        windowMs: config.rateLimit.writeWindowMs,
        max: config.rateLimit.writeMax,
        keyPrefix: 'write:'
      }),
      crawl: rateLimit({
        windowMs: config.rateLimit.writeWindowMs,
        max: config.rateLimit.crawlMax,
        keyPrefix: 'crawl:'
      }),
      websearch: rateLimit({
        windowMs: config.rateLimit.searchWindowMs,
        max: config.rateLimit.websearchMax,
        keyPrefix: 'websearch:'
      })
    }
  : { search: (req, res, next) => next(), write: (req, res, next) => next(), crawl: (req, res, next) => next(), websearch: (req, res, next) => next() };

// Borang hubungi: hadkan setiap pelawat kepada 5 hantaran / 10 minit
const contactLimiter = config.rateLimit.enabled
  ? rateLimit({ windowMs: 10 * 60 * 1000, max: 5, keyPrefix: 'contact:' })
  : (req, res, next) => next();

const app = express();
app.disable('x-powered-by');

// SEO: canonical host — semua permintaan www di301 ke apex
app.use((req, res, next) => {
  if (req.hostname === 'www.tukuk.org') {
    return res.redirect(301, `https://tukuk.org${req.originalUrl}`);
  }
  next();
});

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '64kb' }));
// Gzip: semua teks (HTML/JSON) dipampatkan — halaman ~32KB jadi ~8KB.
app.use(compression());

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

// Akses global: beritahu Tor Browser tentang onion mirror automatik
// (header Onion-Location → Tor Browser tawar buka laman via onion).
const ONION_HOST = process.env.ONION_HOST || 'd33axv7iaq4sp5hlwjn7i2tovkuxmxc53xl2drjhve7mboitsoicdfid.onion';
app.use((req, res, next) => {
  if (!/\.[a-z0-9]+$/i.test(req.path) || req.path.endsWith('.html')) {
    res.setHeader('Onion-Location', `http://${ONION_HOST}${req.originalUrl}`);
  }
  next();
});

app.use(express.static(PUBLIC_DIR, {
  index: 'index.html',
  maxAge: '1h',
  setHeaders(res, filePath) {
    // Service worker: JANGAN sekali cache — pelanggan mesti dapat versi terkini terus.
    if (filePath.endsWith('sw.js')) res.setHeader('Cache-Control', 'no-store');
    // HTML: biar revalidate setiap kali supaya kemas-kini segera kelihatan.
    else if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
    // CSS/JS: revalidate setiap kali — kemas-kini gaya segera kelihatan (browser + edge cache).
    else if (/\.(css|js)$/.test(filePath)) res.setHeader('Cache-Control', 'no-cache');
  }
}));

// URL bersih untuk halaman statik: /privacy -> public/privacy.html
const STATIC_PAGES = ['about', 'privacy', 'terms', 'contact', 'dev', 'terminal', 'settings', 'docs', 'nasa', 'explore', 'access', 'bingbot'];
for (const name of STATIC_PAGES) {
  app.get(`/${name}`, (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, `${name}.html`), (error) => {
      if (error) res.status(404).json({ error: 'Halaman tidak dijumpai', path: req.originalUrl });
    });
  });
}

// Alias bahasa supaya pautan sedia ada tidak 404
const PAGE_ALIASES = { tentang: 'about', hubungi: 'contact', terma: 'terms', privasi: 'privacy', dokumen: 'docs' };
for (const [alias, name] of Object.entries(PAGE_ALIASES)) {
  app.get(`/${alias}`, (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, `${name}.html`), (error) => {
      if (error) res.status(404).json({ error: 'Halaman tidak dijumpai', path: req.originalUrl });
    });
  });
}

app.get("/test", (req, res) => res.send("OK"));

app.use((req, res, next) => {
  const startedAt = process.hrtime.bigint();
  requestCount += 1;
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - startedAt) / 1e6;
    const line = `${req.method} ${req.originalUrl} ${res.statusCode} ${ms.toFixed(1)}ms`;
    if (res.statusCode >= 400) {
      errorCount += 1;
      console.error(`[http] ${line}`);
    } else if (process.env.LOG_REQUESTS !== '0') {
      console.log(`[http] ${line}`);
    }
  });
  next();
});

function clampLimit(value) {
  const limit = Number.parseInt(value, 10);
  if (!Number.isFinite(limit) || limit < 1) return config.search.defaultLimit;
  return Math.min(limit, config.search.maxLimit);
}

const FACETS = ['host', 'lang', 'type', 'siteName', 'keywords', 'section'];

function literal(value) {
  return `"${String(value).replace(/["\\]/g, '\\$&')}"`;
}

function buildFilter(query) {
  const filters = [];

  if (query.host) {
    const hosts = String(query.host).split(',').map((item) => item.trim()).filter(Boolean);
    filters.push(`(${hosts.map((host) => `host = ${literal(host)}`).join(' OR ')})`);
  }
  if (query.lang) {
    const langs = String(query.lang).split(',').map((item) => item.trim().toLowerCase()).filter(Boolean);
    filters.push(`(${langs.map((lang) => `lang = ${literal(lang)}`).join(' OR ')})`);
  }
  if (query.type) {
    const types = String(query.type).split(',').map((item) => item.trim()).filter(Boolean);
    filters.push(`(${types.map((type) => `type = ${literal(type)}`).join(' OR ')})`);
  }
  if (query.site) filters.push(`siteName = ${literal(String(query.site).trim())}`);
  if (query.section) filters.push(`section = ${literal(String(query.section).trim())}`);

  if (query.after) filters.push(`crawledAt > ${literal(String(query.after))}`);
  if (query.before) filters.push(`crawledAt < ${literal(String(query.before))}`);

  if (query.minWords) filters.push(`wordCount >= ${Number.parseInt(query.minWords, 10) || 0}`);

  if (query.excludeHost) {
    const hosts = String(query.excludeHost).split(',').map((item) => item.trim()).filter(Boolean);
    filters.push(`(${hosts.map((host) => `host != ${literal(host)}`).join(' AND ')})`);
  }

  return filters.join(' AND ');
}

const HIGHLIGHT_FIELDS = ['title', 'description', 'headings', 'content'];

function buildSearchParams(query) {
  const params = {
    limit: clampLimit(query.limit),
    offset: Math.max(0, Number.parseInt(query.offset, 10) || 0),
    attributesToHighlight: HIGHLIGHT_FIELDS,
    attributesToCrop: ['content'],
    cropLength: config.search.cropLength,
    highlightPreTag: config.search.highlightPreTag,
    highlightPostTag: config.search.highlightPostTag,
    showMatchesPosition: true,
    matchingStrategy: query.smart === 'false' ? 'last' : 'frequency'
  };

  const filter = buildFilter(query);
  if (filter) params.filter = filter;

  if (query.sort === 'newest') params.sort = ['publishedAt:desc', 'crawledAt:desc'];
  else if (query.sort === 'oldest') params.sort = ['publishedAt:asc'];
  else if (query.sort === 'longest') params.sort = ['wordCount:desc'];
  else if (query.sort === 'shortest') params.sort = ['wordCount:asc'];

  if (query.facets !== 'false') params.facets = [...FACETS];
  if (query.attributes) params.attributesToRetrieve = String(query.attributes).split(',').map((item) => item.trim());

  return params;
}

function reshape(hit, { includeContent = false } = {}) {
  const { _formatted, _matchesPosition, content, ...rest } = hit;
  const formatted = _formatted || {};
  const highlights = Object.fromEntries(
    Object.entries(formatted).filter(
      ([key, value]) =>
        HIGHLIGHT_FIELDS.includes(key) &&
        typeof value === 'string' &&
        value.includes(config.search.highlightPreTag)
    )
  );

  return {
    ...rest,
    snippet: formatted.content
      ? `${formatted.content}…`
      : truncate(rest.description, 200),
    highlights,
    matchedTerms: _matchesPosition ? Object.keys(_matchesPosition) : [],
    ...(includeContent ? { content } : {})
  };
}

app.get('/ask', limiter.search, async (req, res) => {
  const question = String(req.query.q || req.query.question || '').trim();
  if (!question) {
    return res.status(400).json({ error: 'Soalan diperlukan (parameter q)' });
  }

  if (!config.brain.enabled) {
    return res.status(503).json({ error: 'Otak dilumpuhkan (BRAIN_ENABLED=false)' });
  }

  const health = await brain.health();
  if (!health.online) {
    return res.status(503).json({
      error: 'Otak tidak dapat dicapai',
      detail: `Ollama tidak menjawab di ${config.brain.ollamaHost}. Tukuk-OS tetap boleh carian — guna /search.`,
      network: net.snapshot()
    });
  }

  try {
    const offline = !net.snapshot().internet;
    const answer = await rag.ask(question);
    store.recordAsk(question, {
      mode: answer.mode,
      tookMs: answer.tookMs,
      sources: answer.sources.length,
      offline
    });
    res.json({
      question,
      answer: answer.answer,
      mode: answer.mode,
      model: answer.model,
      sources: answer.sources,
      tookMs: answer.tookMs,
      cached: Boolean(answer.cached),
      offline,
      warning: answer.warning,
      network: net.snapshot().status
    });
  } catch (error) {
    res.status(500).json({ error: 'Otak gagal menjawab', details: safeError(error) });
  }
});

app.get('/brain', async (req, res) => {
  const [health, network] = await Promise.all([brain.health(), net.check()]);
  res.json({
    enabled: config.brain.enabled,
    provider: 'ollama',
    host: config.brain.ollamaHost,
    chain: config.brain.chain,
    activeModel: health.model,
    online: health.online,
    models: health.models || [],
    satisfied: health.satisfied,
    parameters: {
      temperature: config.brain.temperature,
      maxTokens: config.brain.maxTokens,
      contextWindow: config.brain.contextWindow,
      timeout: config.brain.timeout,
      retrievalLimit: config.brain.retrievalLimit
    },
    answerCache: rag.cacheStats(),
    network,
    note:
      'Model 135M hanya boleh bergantung kepada sumber yang diberikan. ' +
      'Tanpa sumber, jawapannya tidak boleh dipercayai.'
  });
});

app.get('/network', async (req, res) => {
  res.json(await net.check());
});

app.get('/sitemap.xml', async (req, res) => {
  const host = req.get('host') || 'tukuk.org';
  const base = host.includes('tukuk.org') ? `https://${host}` : `${req.protocol}://${host}`;
  const staticPages = ['', '/nasa', '/explore', '/docs', '/about', '/privacy', '/terms', '/contact', '/blog', '/access', '/learn', '/bingbot'];
  const posts = store.getAllPosts(200);
  
  const urls = [];
  for (const page of staticPages) {
    // Homepage ikut canonical (akhiran '/'); halaman lain tanpa slash
    const loc = page === '' ? `${base}/` : `${base}${page}`;
    urls.push(`  <url>\n    <loc>${loc}</loc>\n    <changefreq>daily</changefreq>\n    <priority>${page === '' ? '1.0' : '0.8'}</priority>\n  </url>`);
  }
  for (const post of posts) {
    const lastMod = post.updatedAt ? post.updatedAt.slice(0, 10) : new Date().toISOString().slice(0, 10);
    urls.push(`  <url>\n    <loc>${base}/blog/${encodeURIComponent(post.slug)}</loc>\n    <lastmod>${lastMod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>`);
  }

  res.type('application/xml').send(
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.join('\n') +
    `\n</urlset>\n`
  );
});

// Blog templates & markdown parser
function renderMarkdown(md) {
  if (!md) return '';
  let html = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/gim, '<em>$1</em>')
    .replace(/`([^`]+)`/gim, '<code>$1</code>')
    .replace(/^\s*-\s+(.*$)/gim, '<li>$1</li>')
    .replace(/^\s*\d+\.\s+(.*$)/gim, '<li>$1</li>');
  
  html = html.replace(/(<li>.*<\/li>)/gim, '<ul>$1</ul>');
  html = html.split('\n\n').map(p => {
    p = p.trim();
    if (!p) return '';
    if (p.startsWith('<h') || p.startsWith('<ul') || p.startsWith('<ol') || p.startsWith('<li')) return p;
    return `<p>${p.replace(/\n/g, '<br>')}</p>`;
  }).join('\n');
  return html;
}

const COMMON_CSS = `
  :root { --bg:#0f1115; --panel:#171a21; --line:#262b36; --text:#e6e9ef; --muted:#9aa3b2; --accent:#4c8dff; --code-bg:#12151c; }
  @media (prefers-color-scheme: light) { :root { --bg:#f7f8fa; --panel:#fff; --line:#e3e6ec; --text:#151922; --muted:#5c6472; --accent:#1f6feb; --code-bg:#f0f3f8; } }
  * { box-sizing:border-box; }
  :focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
  body { margin:0; background:var(--bg); color:var(--text); font:16px/1.75 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; }
  .wrap { max-width:820px; margin:0 auto; padding:0 20px; }
  header { padding:48px 0 16px; border-bottom:1px solid var(--line); }
  h1 { margin:0 0 8px; font-size:2.2rem; letter-spacing:-.5px; }
  h2 { margin:34px 0 10px; font-size:1.3rem; }
  h3 { margin:22px 0 8px; font-size:1.08rem; color:var(--accent); }
  .tagline { color:var(--muted); font-size:1.05rem; margin:0; }
  a { color:var(--accent); text-decoration:none; }
  a:hover { text-decoration:underline; }
  nav { display:flex; gap:16px; flex-wrap:wrap; margin:18px 0 0; font-size:.92rem; }
  footer { margin:54px 0 36px; padding-top:20px; border-top:1px solid var(--line); color:var(--muted); font-size:.88rem; text-align:center; }
  .post-card { background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:22px; margin:22px 0; transition:border-color .2s; }
  .post-card:hover { border-color:var(--accent); }
  .post-card h2 { margin:0 0 8px; font-size:1.4rem; }
  .meta { color:var(--muted); font-size:.88rem; margin-bottom:12px; }
  .tags { display:flex; gap:8px; flex-wrap:wrap; margin-top:14px; }
  .tag { background:var(--bg); border:1px solid var(--line); border-radius:4px; padding:2px 8px; font-size:.8rem; color:var(--muted); }
  article { background:var(--panel); border:1px solid var(--line); border-radius:12px; padding:28px; margin:28px 0; }
  code { background:var(--code-bg); border:1px solid var(--line); border-radius:4px; padding:2px 6px; font-size:.9em; font-family:monospace; }
  ul, ol { padding-left:24px; margin:14px 0; }
  li { margin-bottom:6px; }
  .back-link { display:inline-block; margin-bottom:16px; font-size:.92rem; }
  .ad-slot { margin:24px 0; overflow:hidden; }
`;

// Blog routes
function adUnit(slot, label) {
  if (!config.adsense.enabled || !slot) return '';
  return `
    <div class="ad-slot" aria-label="Iklan ${label}">
      <ins class="adsbygoogle" style="display:block" data-ad-client="${config.adsense.client}" data-ad-slot="${slot}" data-ad-format="auto" data-full-width-responsive="true"></ins>
    </div>
    <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>`;
}

app.get('/blog', (req, res) => {
  const posts = store.getAllPosts(100);
  let html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Blog &amp; Tech Knowledge Base &mdash; Tukuk-OS</title>
<meta name="description" content="Articles, tutorials and analysis on search engine technology, data privacy and artificial intelligence from Tukuk-OS.">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Tukuk-OS">
<meta property="og:title" content="Blog &amp; Tech Knowledge Base — Tukuk-OS">
<meta property="og:description" content="Articles, tutorials and analysis on search engine technology, data privacy and artificial intelligence from Tukuk-OS.">
<meta property="og:url" content="https://tukuk.org/blog">
<meta property="og:image" content="https://tukuk.org/og.png">
<meta property="og:locale" content="en_US">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Blog &amp; Tech Knowledge Base — Tukuk-OS">
<meta name="twitter:description" content="Articles, tutorials and analysis on search engine technology, data privacy and artificial intelligence from Tukuk-OS.">
<meta name="twitter:image" content="https://tukuk.org/og.png">
<link rel="canonical" href="https://tukuk.org/blog">
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" type="image/svg+xml" href="/icon.svg">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${config.adsense.client}" crossorigin="anonymous"></script>
<script async src="https://fundingchoicesmessages.google.com/i/pub-8954948214333501?ers=1"></script><script>(function() {function signalGooglefcPresent() {if (!window.frames['googlefcPresent']) {if (document.body) {const iframe = document.createElement('iframe'); iframe.style = 'width: 0; height: 0; border: none; z-index: -1000; left: -1000px; top: -1000px;'; iframe.style.display = 'none'; iframe.name = 'googlefcPresent'; document.body.appendChild(iframe);} else {setTimeout(signalGooglefcPresent, 0);}}}signalGooglefcPresent();})();</script>
<script src="/fc-error.js"></script>
<meta name="google-adsense-account" content="${config.adsense.client}">
<style>${COMMON_CSS}</style>
<script src="/theme.js"></script>
<link rel="stylesheet" href="/theme.css">
<!-- Clarity tracking code for https://tukuk.org/ -->
<script>
    (function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i+"?ref=bwt";
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
    })(window, document, "clarity", "script", "ytshvg0zer");
</script>
</head>
<body>
<div class="wrap">
  <header>
    <h1>Blog &amp; Knowledge Archive</h1>
    <p class="tagline">In-depth articles on search engine technology, cybersecurity, semantic AI and web privacy.</p>
    <nav>
      <a href="/">Home</a>
      <a href="/explore">Explore</a>
      <a href="/nasa">NASA</a>
      <a href="/learn">Learn</a>
      <a href="/blog">Blog</a>
      <a href="/docs">Docs</a>
      <a href="/about">About</a>
      <a href="/privacy">Privacy</a>
      <a href="/terms">Terms</a>
      <a href="/contact">Contact</a>
      <span class="theme-tools">
        <button type="button" id="theme-toggle" class="tk-btn" aria-label="Colour theme">◐</button>
        <span class="tk-accents" role="group" aria-label="Accent colour">
          <button type="button" data-accent-set="blue" class="tk-dot" aria-label="Blue"></button>
          <button type="button" data-accent-set="green" class="tk-dot" aria-label="Green"></button>
          <button type="button" data-accent-set="violet" class="tk-dot" aria-label="Violet"></button>
          <button type="button" data-accent-set="amber" class="tk-dot" aria-label="Amber"></button>
          <button type="button" data-accent-set="rose" class="tk-dot" aria-label="Rose"></button>
        </span>
      </span>
    </nav>
  </header>
  <main>${adUnit(config.adsense.slotTop, 'top')}`;

  for (const post of posts) {
    const postDate = new Date(post.createdAt).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' });
    html += `
    <div class="post-card">
      <h2><a href="/blog/${encodeURIComponent(post.slug)}">${post.title}</a></h2>
      <div class="meta">${postDate} &middot; Author: ${post.author || 'Fevian Donald'}</div>
      <p>${post.excerpt}</p>
      ${post.tags && post.tags.length ? `<div class="tags">${post.tags.map(t => `<span class="tag">#${t}</span>`).join('')}</div>` : ''}
    </div>`;
  }

  html += `
  ${adUnit(config.adsense.slotBottom, 'bottom')}
  </main>
  <footer>
    <p>&copy; 2026 Tukuk-OS &mdash; All rights reserved. A free and open web search engine.</p>
  </footer>
</div>
</body>
</html>`;
  res.send(html);
});

// Kurikulum "Tukuk-OS 0 -> Hero": susunan pembelajaran merentas semua artikel.
const LEARN_STAGES = [
  {
    n: '0',
    title: 'Zero — Start From Nothing',
    blurb: 'Machine basics, your first page, and the mindset that keeps you going.',
    slugs: [
      'what-is-tukuk-os',
      'learn-programming-by-building-zero-to-hero',
      'from-broken-laptop-to-first-attempt',
      'learning-ubuntu-from-zero-to-terminal',
      '10-terminal-commands-i-still-use',
      'my-first-html-and-css-page',
      'my-first-javascript',
    ],
  },
  {
    n: '1',
    title: 'Build — Foundations of the Web',
    blurb: 'Servers, HTTP, version control, testing, and debugging like a professional.',
    slugs: [
      'my-first-nodejs-server',
      'why-i-chose-nodejs-and-express',
      'http-and-apis-fundamentals',
      'http-status-codes-and-when-to-use-them',
      'git-and-github-for-solo-projects',
      'testing-your-nodejs-app-without-ceremony',
      'logging-and-debugging-in-production',
      'browser-devtools-for-backend-people',
      'git-bisect-finding-the-commit-that-broke-it',
      'race-conditions-in-nodejs-async-bugs',
      'off-by-one-and-common-logic-bugs',
      'famous-software-bugs-that-changed-engineering',
    ],
  },
  {
    n: '2',
    title: 'Search — Inside the Engine',
    blurb: 'Crawling, inverted indexes, ranking, and the search index that powers it all.',
    slugs: [
      'my-first-web-crawler',
      'how-crawlers-collect-documents-for-indexing',
      'building-an-inverted-index-by-hand',
      'inverted-index-behind-search',
      'how-modern-search-engines-work',
      'meilisearch-beginners-guide',
      'getting-to-know-meilisearch-fast-search-engine',
      'meilisearch-fast-indexing-for-tukuk-os',
      'bm25-relevance-explained',
      'image-and-video-search-in-tukuk-os',
    ],
  },
  {
    n: '3',
    title: 'Ship — Deploy, Protect, Stay Reachable',
    blurb: 'Domains, HTTPS, caching, abuse protection — and staying online when someone tries to stop you.',
    slugs: [
      'cloudflare-tunnel-and-a-free-domain',
      'nginx-reverse-proxy-cloudflare-guide',
      'cloudflare-workers-serverless-at-edge',
      'http2-and-http3-quic-brief-guide',
      'caching-strategy-and-circuit-breakers',
      'redis-cache-for-fast-web-apps',
      'service-worker-caching-network-first-vs-cache-first',
      'rate-limiting-and-basic-abuse-protection',
      'understanding-progressive-web-apps',
      'cloudflare-anycast-global-availability',
      'why-no-website-is-100-percent-unblockable',
      'tor-onion-services-for-websites',
      'onion-location-header-explained',
      'dns-over-https-explained',
    ],
  },
  {
    n: '4',
    title: 'Grow — Traffic, Content, Money',
    blurb: 'SEO, indexing pipelines, analytics without cookies, and keeping the lights funded.',
    slugs: [
      'seo-for-new-blogs-10-practical-steps',
      'seo-on-page-content-google-loves',
      'web-optimization-basic-and-technical-seo',
      'indexnow-submit-urls-instantly-to-bing',
      'rss-feeds-for-news-discovery',
      'inline-video-player-embeds',
      'the-tukuk-os-blogging-system',
      'cookieless-web-analytics-ga-alternatives',
      'adsense-for-small-blogs-an-honest-guide',
      'contact-form-and-cloudflare-email',
      'automation-backups-and-watchdogs',
      'building-a-backup-system-with-cloudflare',
      'monitoring-uptime-for-free',
      'launch-checklist-for-a-side-project',
      'the-real-cost-of-running-tukuk-os',
    ],
  },
  {
    n: '5',
    title: 'Master — Privacy, AI, Philosophy',
    blurb: 'The ideas layer: data ownership, honest AI answers, and the story of Tukuk-OS itself.',
    slugs: [
      'privacy-without-tracking-cookies',
      'local-ai-privacy-no-data-to-cloud',
      'digital-privacy-and-free-web-search',
      'data-sovereignty-free-search-infrastructure',
      'cybersecurity-guide-protecting-your-privacy',
      'extractive-vs-abstractive-ai-answers',
      'future-of-ai-semantic-search-and-rag',
      'parsing-search-results-language-market-signals',
      'how-tukuk-os-became-a-free-web-search-engine',
      'tukuk-os-complete-feature-tour',
      'tukuk-os-is-alive-reflections',
      'tukuk-os-bug-retrospective',
    ],
  },
];

app.get('/learn', (req, res) => {
  let html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Tukuk-OS Academy: Zero to Hero Learning Path</title>
<meta name="description" content="A free six-stage curriculum: from your first terminal command to running, defending and growing your own search engine.">
<link rel="canonical" href="https://tukuk.org/learn">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Tukuk-OS">
<meta property="og:title" content="Tukuk-OS Academy: Zero to Hero Learning Path">
<meta property="og:description" content="A free six-stage curriculum: from your first terminal command to running, defending and growing your own search engine.">
<meta property="og:url" content="https://tukuk.org/learn">
<meta property="og:image" content="https://tukuk.org/og.png">
<meta property="og:locale" content="en_US">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Tukuk-OS Academy: Zero to Hero Learning Path">
<meta name="twitter:description" content="A free six-stage curriculum: from your first terminal command to running, defending and growing your own search engine.">
<meta name="twitter:image" content="https://tukuk.org/og.png">
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" type="image/svg+xml" href="/icon.svg">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta name="theme-color" content="#4c8dff">
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${config.adsense.client}" crossorigin="anonymous"></script>
<script async src="https://fundingchoicesmessages.google.com/i/pub-8954948214333501?ers=1"></script><script>(function() {function signalGooglefcPresent() {if (!window.frames['googlefcPresent']) {if (document.body) {const iframe = document.createElement('iframe'); iframe.style = 'width: 0; height: 0; border: none; z-index: -1000; left: -1000px; top: -1000px;'; iframe.style.display = 'none'; iframe.name = 'googlefcPresent'; document.body.appendChild(iframe);} else {setTimeout(signalGooglefcPresent, 0);}}}signalGooglefcPresent();})();</script>
<script src="/fc-error.js"></script>
<meta name="google-adsense-account" content="${config.adsense.client}">
<style>${COMMON_CSS}
.stage-head{display:flex;align-items:baseline;gap:12px;margin:44px 0 6px;}
.stage-num{display:inline-flex;align-items:center;justify-content:center;min-width:38px;height:38px;border-radius:50%;
  background:var(--accent-fill,#2a6edb);color:#fff;font-weight:700;font-size:1rem;flex:none;}
.stage-title{margin:0;font-size:1.3rem;}
.stage-blurb{color:#9aa3b2;margin:4px 0 14px 50px;}
.stage-list{list-style:none;margin:0 0 8px;padding:0 0 0 50px;counter-reset:lesson;}
.stage-list li{counter-increment:lesson;position:relative;padding:9px 12px 9px 44px;border-bottom:1px solid var(--line,#262b36);}
.stage-list li::before{content:counter(lesson);position:absolute;left:8px;top:9px;width:24px;height:24px;border-radius:6px;
  background:var(--panel,#171a21);border:1px solid var(--line,#262b36);font-size:.75rem;display:flex;align-items:center;justify-content:center;color:#9aa3b2;}
.stage-list a{font-weight:600;text-decoration:none;color:inherit;}
.stage-list a:hover{color:var(--accent,#4c8dff);text-decoration:underline;}
.stage-list .ex{display:block;font-size:.88rem;color:#9aa3b2;font-weight:400;margin-top:2px;}
.learn-intro{font-size:1.05rem;}
.badge-count{display:inline-block;background:rgba(76,141,255,.15);border:1px solid rgba(76,141,255,.35);color:var(--accent,#4c8dff);
  border-radius:999px;padding:2px 12px;font-size:.85rem;font-weight:600;margin-left:8px;}
</style>
<script src="/theme.js"></script>
<link rel="stylesheet" href="/theme.css">
<!-- Clarity tracking code for https://tukuk.org/ -->
<script>
    (function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i+"?ref=bwt";
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
    })(window, document, "clarity", "script", "ytshvg0zer");
</script>
</head>
<body>
<div class="wrap">
  <header>
    <h1>Tukuk-OS Academy<span class="badge-count" id="lesson-count"></span></h1>
    <p class="tagline">Zero to Hero: one free curriculum from your first terminal command to running, defending and growing your own search engine.</p>
    <p class="learn-intro">Follow the stages in order — each lesson assumes only what came before it. Stuck at any point? Start at <a href="/learn">Stage 0</a> and keep the <a href="/blog">full archive</a> within reach.</p>
    <nav>
      <a href="/">Home</a>
      <a href="/learn">Learn</a>
      <a href="/blog">Blog</a>
      <a href="/explore">Explore</a>
      <a href="/docs">Docs</a>
      <a href="/about">About</a>
      <a href="/access">Global Access</a>
    </nav>
  </header>
  <main>`;

  let lessonNo = 0;
  for (const stage of LEARN_STAGES) {
    html += `
    <div class="stage-head"><span class="stage-num">${stage.n}</span><h2 class="stage-title">${stage.title}</h2></div>
    <p class="stage-blurb">${stage.blurb}</p>
    <ol class="stage-list">`;
    for (const slug of stage.slugs) {
      const post = store.getPostBySlug(slug);
      if (!post) continue;
      lessonNo += 1;
      html += `
      <li><a href="/blog/${encodeURIComponent(post.slug)}">${post.title}</a><span class="ex">${post.excerpt || ''}</span></li>`;
    }
    html += `
    </ol>`;
  }

  html += `
  </main>
  <footer>
    <p>&copy; 2026 Tukuk-OS &mdash; All rights reserved. A free and open web search engine.</p>
  </footer>
</div>
<script>document.getElementById('lesson-count').textContent='${lessonNo} lessons';</script>
</body>
</html>`;
  res.send(html);
});

app.get('/blog/:slug', (req, res) => {
  const post = store.getPostBySlug(req.params.slug);
  if (!post) {
    const redirectTo = blogRedirects[req.params.slug];
    if (redirectTo) return res.redirect(301, `/blog/${encodeURIComponent(redirectTo)}`);
    return res.status(404).send(`<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Article Not Found &mdash; Tukuk-OS</title><style>${COMMON_CSS}</style><script src="/theme.js"></script><link rel="stylesheet" href="/theme.css">
<script src="/theme.js"></script>
<link rel="stylesheet" href="/theme.css"><!-- Clarity tracking code for https://tukuk.org/ -->
<script>
    (function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i+"?ref=bwt";
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
    })(window, document, "clarity", "script", "ytshvg0zer");
</script>
</head><body><div class="wrap" style="padding-top:60px"><h1>404 &mdash; Article not found</h1><p>Sorry, the article you are looking for does not exist or has moved.</p><p><a href="/blog">&larr; Back to the blog</a></p></div></body></html>`);
  }

  const postDate = new Date(post.createdAt).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' });
  const renderedContent = renderMarkdown(post.content);

  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": post.title,
    "description": post.excerpt,
    "author": {
      "@type": "Person",
      "name": post.author || "Fevian Donald"
    },
    "datePublished": post.createdAt,
    "dateModified": post.updatedAt || post.createdAt,
    "mainEntityOfPage": `https://tukuk.org/blog/${post.slug}`,
    "publisher": {
      "@type": "Organization",
      "name": "Tukuk-OS",
      "url": "https://tukuk.org"
    }
  });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${post.title} &mdash; Tukuk-OS</title>
<meta name="description" content="${post.excerpt.replace(/"/g, '&quot;')}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Tukuk-OS">
<meta property="og:title" content="${post.title.replace(/"/g, '&quot;')}">
<meta property="og:description" content="${post.excerpt.replace(/"/g, '&quot;')}">
<meta property="og:url" content="https://tukuk.org/blog/${encodeURIComponent(post.slug)}">
<meta property="og:image" content="https://tukuk.org/og.png">
<meta property="article:published_time" content="${post.createdAt}">
<meta property="article:author" content="${(post.author || 'Fevian Donald').replace(/"/g, '&quot;')}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${post.title.replace(/"/g, '&quot;')}">
<meta name="twitter:description" content="${post.excerpt.replace(/"/g, '&quot;')}">
<meta name="twitter:image" content="https://tukuk.org/og.png">
<link rel="canonical" href="https://tukuk.org/blog/${encodeURIComponent(post.slug)}">
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" type="image/svg+xml" href="/icon.svg">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<script type="application/ld+json">${jsonLd}</script>
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${config.adsense.client}" crossorigin="anonymous"></script>
<script async src="https://fundingchoicesmessages.google.com/i/pub-8954948214333501?ers=1"></script><script>(function() {function signalGooglefcPresent() {if (!window.frames['googlefcPresent']) {if (document.body) {const iframe = document.createElement('iframe'); iframe.style = 'width: 0; height: 0; border: none; z-index: -1000; left: -1000px; top: -1000px;'; iframe.style.display = 'none'; iframe.name = 'googlefcPresent'; document.body.appendChild(iframe);} else {setTimeout(signalGooglefcPresent, 0);}}}signalGooglefcPresent();})();</script>
<script src="/fc-error.js"></script>
<meta name="google-adsense-account" content="${config.adsense.client}">
<style>${COMMON_CSS}</style>
<script src="/theme.js"></script>
<link rel="stylesheet" href="/theme.css">
<!-- Clarity tracking code for https://tukuk.org/ -->
<script>
    (function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i+"?ref=bwt";
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
    })(window, document, "clarity", "script", "ytshvg0zer");
</script>
</head>
<body>
<div class="wrap">
  <header>
    <a href="/blog" class="back-link">&larr; Back to all articles</a>
    <h1>${post.title}</h1>
    <div class="meta">Published: ${postDate} &middot; Author: ${post.author || 'Fevian Donald'}</div>
    <nav>
      <a href="/">Home</a>
      <a href="/explore">Explore</a>
      <a href="/nasa">NASA</a>
      <a href="/blog">Blog</a>
      <a href="/docs">Docs</a>
      <a href="/about">About</a>
      <a href="/privacy">Privacy</a>
      <a href="/terms">Terms</a>
      <a href="/contact">Contact</a>
      <span class="theme-tools">
        <button type="button" id="theme-toggle" class="tk-btn" aria-label="Colour theme">◐</button>
        <span class="tk-accents" role="group" aria-label="Accent colour">
          <button type="button" data-accent-set="blue" class="tk-dot" aria-label="Blue"></button>
          <button type="button" data-accent-set="green" class="tk-dot" aria-label="Green"></button>
          <button type="button" data-accent-set="violet" class="tk-dot" aria-label="Violet"></button>
          <button type="button" data-accent-set="amber" class="tk-dot" aria-label="Amber"></button>
          <button type="button" data-accent-set="rose" class="tk-dot" aria-label="Rose"></button>
        </span>
      </span>
    </nav>
  </header>
  <main>
    ${adUnit(config.adsense.slotTop, 'top')}
    <article>
      ${renderedContent}
      ${adUnit(config.adsense.slotInArticle, 'in-article')}
      ${post.tags && post.tags.length ? `<div class="tags" style="margin-top:28px; padding-top:16px; border-top:1px solid var(--line);">${post.tags.map(t => `<span class="tag">#${t}</span>`).join('')}</div>` : ''}
    </article>
    ${adUnit(config.adsense.slotBottom, 'bottom')}
  </main>
  <footer>
    <p>&copy; 2026 Tukuk-OS &mdash; All rights reserved. A free and open web search engine.</p>
  </footer>
</div>
</body>
</html>`;
  res.send(html);
});

app.get('/api', (req, res) => {
  res.json({
    name: 'Tukuk-OS Search API',
    version: '2.0.0',
    documentation: 'https://tukuk.org/docs',
    auth: config.security.apiKey ? 'X-API-Key required on mutation routes' : 'none',
    endpoints: [
      { method: 'GET', path: '/search', description: 'Full search with highlighting, facets and filters' },
      { method: 'GET', path: '/suggest', description: 'Autocomplete suggestions' },
      { method: 'GET', path: '/answer', description: 'AI answer card for a query (grounded in index + web results)' },
      { method: 'GET', path: '/trending', description: 'Trending queries from the last 7 days' },
      { method: 'GET', path: '/api/bingbot', description: 'Verify an IP is Bingbot (rDNS + forward-confirm + published list)' },
      { method: 'GET', path: '/websearch', description: 'Web search (merged: Bing, Brave, Wikipedia, DDG + tech verticals)' },
      { method: 'GET', path: '/images', description: 'Web image search' },
      { method: 'GET', path: '/music', description: 'Music search (iTunes)' },
      { method: 'GET', path: '/radio', description: 'Live internet radio stations' },
      { method: 'GET', path: '/videos', description: 'Web video search' },
      { method: 'GET', path: '/news', description: 'News search (RSS: BBC, TechCrunch, The Verge, NASA, Hacker News)' },
      { method: 'GET', path: '/health', description: 'Service status' },
      { method: 'GET', path: '/stats', description: 'Index metrics and settings' },
      { method: 'GET', path: '/sitemap.xml', description: 'XML sitemap' },
      { method: 'GET', path: '/blog', description: 'Blog article listing' },
      { method: 'GET', path: '/api/explore/earthquakes', description: 'Earthquakes, last 7 days (USGS)' },
      { method: 'GET', path: '/api/explore/countries', description: 'Country data (World Bank)' },
      { method: 'GET', path: '/api/explore/geocode', description: 'Geocode place names (Open-Meteo)' },
      { method: 'GET', path: '/api/explore/weather', description: 'Weather and forecast (Open-Meteo)' },
      { method: 'GET', path: '/api/explore/sun', description: 'Sunrise and sunset times' },
      { method: 'GET', path: '/api/explore/arxiv', description: 'Research papers (arXiv)' },
      { method: 'GET', path: '/api/explore/ip', description: 'Visitor IP geolocation' },
      { method: 'GET', path: '/api/nasa/apod', description: 'Astronomy Picture of the Day' },
      { method: 'GET', path: '/api/nasa/asteroids', description: 'Near-Earth asteroids (NeoWs)' },
      { method: 'GET', path: '/api/nasa/experiments/asteroid-trend', description: 'Experiment: asteroid approach trend (weeks)' },
      { method: 'GET', path: '/api/nasa/experiments/solar', description: 'Experiment: solar flares & CME (days)' },
      { method: 'POST', path: '/api/contact', description: 'Contact form submission' },
      { method: 'GET', path: '/api/contact/messages', description: 'Read stored contact messages', auth: true },
      { method: 'POST', path: '/crawl', description: 'Crawl a single URL', auth: true },
      { method: 'POST', path: '/crawl/batch', description: 'Crawl a list of URLs', auth: true },
      { method: 'POST', path: '/crawl/sitemap', description: 'Crawl URLs from a sitemap', auth: true },
      { method: 'POST', path: '/crawl/site', description: 'BFS crawl of a whole site', auth: true },
      { method: 'POST', path: '/documents', description: 'Index documents directly', auth: true },
      { method: 'DELETE', path: '/documents/:id', description: 'Delete a document', auth: true },
      { method: 'POST', path: '/settings', description: 'Update search settings', auth: true }
    ],
    parameterSearch: ['q', 'limit', 'offset', 'host', 'lang', 'type', 'site', 'section',
      'minWords', 'excludeHost', 'after', 'before', 'sort', 'facets', 'full', 'smart']
  });
});

app.get('/health', async (req, res) => {
  try {
    const meiliHealth = await health();
    const serverStats = await index.getStats();
    res.json({
      status: 'ok',
      uptimeSeconds: Math.round(process.uptime()),
      meilisearch: meiliHealth.status,
      documents: serverStats.numberOfDocuments,
      crawler: crawler.snapshot()
    });
  } catch (error) {
    res.status(503).json({ status: 'degraded', meilisearch: 'unreachable', error: safeError(error) });
  }
});

app.get('/stats', limiter.search, async (req, res) => {
  try {
    const [indexStats, settings] = await Promise.all([index.getStats(), index.getSettings()]);
    res.json({
      documents: indexStats.numberOfDocuments,
      indexSize: indexStats.indexSize,
      searchableAttributes: settings.searchableAttributes,
      rankingRules: settings.rankingRules,
      filters: settings.filterableAttributes,
      fallbackCache: fallback.size(),
      crawler: crawler.snapshot(),
      http: { requests: requestCount, errors: errorCount },
      process: {
        uptimeSeconds: Math.round(process.uptime()),
        memoryMb: Math.round(process.memoryUsage().rss / 1048576),
        startedAt: new Date(START_TIME).toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Gagal membaca statistik', details: safeError(error) });
  }
});

app.get('/search', limiter.search, async (req, res) => {
  const { q, index: indexParam, ...rest } = req.query;
  const corpus = DEMO_INDEXES.has(String(indexParam || '')) ? String(indexParam) : null;
  if (!q || String(q).trim() === '') {
    return res.json({ query: '', hits: [], total: 0, index: corpus || config.indexName });
  }
  try {
    const target = corpus ? client.index(corpus) : index;
    const qq = String(q).trim();
    const result = await target.search(qq, buildSearchParams(rest));
    const total = result.totalHits ?? result.estimatedTotalHits ?? result.hits.length;
    queries.logQuery(qq, { hits: total });
    res.json({
      query: qq,
      index: corpus || config.indexName,
      ...result,
      related: queries.related(qq),
      didYouMean: total === 0 ? queries.didYouMean(qq) : null
    });
  } catch (error) {
    res.status(500).json({ error: 'Pencarian gagal' });
  }
});

// Kad jawapan AI — dipanggil selari oleh tab Web semasa hasil dipaparkan.
app.get('/answer', limiter.search, async (req, res) => {
  try {
    res.json(await answer.getAnswer(String(req.query.q || '')));
  } catch (error) {
    res.status(500).json({ error: 'Jawapan gagal', details: safeError(error) });
  }
});

// Carian trending 7 hari lepas (dari log query).
app.get('/trending', limiter.search, async (req, res) => {
  res.json({ queries: queries.trending(), windowDays: 7, updatedAt: Date.now() });
});

// Carian imej / video / web — dipanggil oleh tab Web, Imej & Video di laman depan
app.get('/websearch', limiter.search, async (req, res) => {
  try {
    res.json(await websearch.search(String(req.query.q || '')));
  } catch (error) {
    res.status(500).json({ error: 'Carian web gagal', details: safeError(error) });
  }
});

app.get('/images', limiter.search, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    res.json(await mediaSearch.searchImages(String(req.query.q || ''), { page }));
  } catch (error) {
    res.status(500).json({ error: 'Carian imej gagal', details: safeError(error) });
  }
});

app.get('/videos', limiter.search, async (req, res) => {
  try {
    const sp = String(req.query.sp || '').slice(0, 200);
    res.json(await mediaSearch.searchVideos(String(req.query.q || ''), { sp }));
  } catch (error) {
    res.status(500).json({ error: 'Carian video gagal', details: safeError(error) });
  }
});

app.get('/news', limiter.search, async (req, res) => {
  try {
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
    res.json(await news.searchNews(String(req.query.q || ''), { offset }));
  } catch (error) {
    res.status(500).json({ error: 'Carian berita gagal', details: safeError(error) });
  }
});

// Semak IP: Bingbot atau tidak (kaedah rasmi Bing: rDNS + forward-confirm)
app.get('/api/bingbot', limiter.search, async (req, res) => {
  try {
    let ip = String(req.query.ip || '').trim();
    if (!ip) {
      // Tanpa ip: gunakan IP pelawat sendiri (Cloudflare beri IP sebenar melalui header)
      ip = String(req.headers['cf-connecting-ip'] || req.headers['x-real-ip'] || req.ip || '').split(',')[0].trim();
    }
    res.json(await bingbot.verify(ip));
  } catch (error) {
    res.status(500).json({ error: 'Semakan Bingbot gagal', details: safeError(error) });
  }
});

app.get('/music', limiter.search, async (req, res) => {
  try {
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
    res.json(await mediaSearch.searchMusic(String(req.query.q || ''), { offset }));
  } catch (error) {
    res.status(500).json({ error: 'Carian muzik gagal', details: safeError(error) });
  }
});

app.get('/radio', limiter.search, async (req, res) => {
  try {
    const skip = Math.max(0, parseInt(req.query.skip, 10) || 0);
    res.json(await mediaSearch.searchRadio(String(req.query.q || ''), { skip }));
  } catch (error) {
    res.status(500).json({ error: 'Carian radio gagal', details: safeError(error) });
  }
});

// Cadangan automatik (autocomplete) untuk kotak carian di laman depan
app.get('/suggest', limiter.search, async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) return res.json({ suggestions: [] });
  try {
    const result = await index.search(q, { limit: 6, attributesToRetrieve: ['title', 'url'] });
    const suggestions = result.hits
      .filter((hit) => hit && hit.title)
      .map((hit) => ({ title: hit.title, url: hit.url || '' }));
    res.json({ suggestions });
  } catch {
    res.json({ suggestions: [] });
  }
});

// NASA Open Data API Endpoints
app.get('/api/nasa/apod', async (req, res) => {
  try {
    const data = await nasa.getAPOD({
      date: req.query.date,
      count: req.query.count
    });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Gagal memuat turun data APOD NASA', details: safeError(error) });
  }
});

app.get('/api/nasa/mars', async (req, res) => {
  try {
    const data = await nasa.getMarsPhotos({
      rover: req.query.rover,
      sol: req.query.sol,
      earth_date: req.query.earth_date,
      camera: req.query.camera,
      page: req.query.page
    });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Gagal memuat turun foto Marikh NASA', details: safeError(error) });
  }
});

app.get('/api/nasa/asteroids', async (req, res) => {
  try {
    const data = await nasa.getNearEarthObjects({
      startDate: req.query.startDate,
      endDate: req.query.endDate
    });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Gagal memuat turun data asteroid NASA', details: safeError(error) });
  }
});

app.get('/api/nasa/epic', async (req, res) => {
  try {
    const data = await nasa.getEPIC({ date: req.query.date });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Gagal memuat turun data EPIC NASA', details: safeError(error) });
  }
});

app.get('/api/nasa/space-weather', async (req, res) => {
  try {
    const data = await nasa.getSpaceWeather({
      type: req.query.type,
      startDate: req.query.startDate,
      endDate: req.query.endDate
    });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Gagal memuat turun cuaca angkasa NASA', details: safeError(error) });
  }
});

app.get('/api/nasa/search', async (req, res) => {
  try {
    const data = await nasa.searchNASAMedia(req.query.q, {
      mediaType: req.query.mediaType || 'image'
    });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Gagal mencari arkib media NASA', details: safeError(error) });
  }
});

app.get('/api/nasa/iss', async (req, res) => {
  try {
    const data = await nasa.getISSTelemetry();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Gagal membaca kedudukan ISS', details: safeError(error) });
  }
});

app.get('/api/nasa/audio', async (req, res) => {
  try {
    const data = await nasa.getSpaceAudio(req.query.q || 'apollo');
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Gagal mencari audio NASA', details: safeError(error) });
  }
});

// NASA Experiments: agregat data terbuka untuk eksperimen interaktif di /nasa
app.get('/api/nasa/experiments/asteroid-trend', async (req, res) => {
  try {
    const weeks = Math.min(Math.max(parseInt(req.query.weeks, 10) || 4, 1), 8);
    res.json(await nasa.getAsteroidTrend({ weeks }));
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengira trend asteroid', details: safeError(error) });
  }
});

app.get('/api/nasa/experiments/solar', async (req, res) => {
  try {
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 14), 42);
    res.json(await nasa.getSolarActivity({ days }));
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengira aktiviti matahari', details: safeError(error) });
  }
});

// Borang hubungi: simpan mesej pelawat (admin baca melalui /api/contact/messages)
const CONTACT_FILE = path.join(path.dirname(config.store.path), 'contact-messages.json');

function loadContactMessages() {
  try {
    return JSON.parse(fs.readFileSync(CONTACT_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function saveContactMessage(entry) {
  const list = loadContactMessages();
  list.unshift(entry);
  const trimmed = list.slice(0, 200);
  fs.mkdirSync(path.dirname(CONTACT_FILE), { recursive: true });
  const temporary = `${CONTACT_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(trimmed, null, 2));
  fs.renameSync(temporary, CONTACT_FILE);
  return trimmed.length;
}

app.post('/api/contact', contactLimiter, (req, res) => {
  const body = req.body || {};
  const name = truncate(String(body.name || '').trim(), 120);
  const email = truncate(String(body.email || '').trim(), 200);
  const message = truncate(String(body.message || '').trim(), 5000);
  const honeypot = String(body.website || '').trim();

  // Bot mengisi medan tersembunyi: buang senyap supaya mereka tidak sedar
  if (honeypot) return res.redirect('/contact?sent=1');
  if (!name || !message || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.redirect(400, '/contact?error=1');
  }

  const entry = {
    id: `msg_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    receivedAt: new Date().toISOString(),
    ip: req.ip,
    userAgent: truncate(String(req.get('user-agent') || ''), 200),
    name,
    email,
    message
  };

  const total = saveContactMessage(entry);
  store.event('contact', `mesej baharu daripada ${name}`, { email, characters: message.length, total });

  // Pilihan: hantar notifikasi segera (Discord/Slack/maka webhook)
  const webhook = process.env.CONTACT_WEBHOOK_URL;
  if (webhook) {
    fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: `Mesej baharu: ${name}`, email, message, at: entry.receivedAt })
    }).catch(() => {});
  }

  res.redirect('/contact?sent=1');
});

app.get('/api/contact/messages', requireApiKey, (req, res) => {
  const list = loadContactMessages();
  res.json({ total: list.length, messages: list.slice(0, Math.min(Number(req.query.limit) || 50, 200)) });
});

// Logger ralat JS pelawat — penambah Clarity ScriptError/ErrorClick (punca tak dapat dari API)
const JS_ERROR_FILE = path.join(path.dirname(config.store.path), 'js-errors.json');
const jsErrorLimiter = config.rateLimit.enabled
  ? rateLimit({ windowMs: 60 * 1000, max: 30, keyPrefix: 'jserr:' })
  : (req, res, next) => next();

function loadJsErrors() {
  try {
    return JSON.parse(fs.readFileSync(JS_ERROR_FILE, 'utf8'));
  } catch {
    return [];
  }
}

app.post('/api/js-error', jsErrorLimiter, (req, res) => {
  const body = req.body || {};
  const message = truncate(String(body.message || ''), 400);
  if (!message) return res.status(400).json({ error: 'message wajib' });

  const entry = {
    at: new Date().toISOString(),
    page: truncate(String(body.page || ''), 300),
    kind: truncate(String(body.kind || 'error'), 20),
    message,
    source: truncate(String(body.source || ''), 300),
    line: Number(body.line) || 0,
    col: Number(body.col) || 0,
    ua: truncate(String(req.get('user-agent') || ''), 200)
  };

  const list = loadJsErrors();
  // gabung mesej sama supaya tak banjiri fail
  const same = list.find((e) => e.message === entry.message && e.page === entry.page);
  if (same) {
    same.count = (same.count || 1) + 1;
    same.lastAt = entry.at;
  } else {
    list.unshift({ ...entry, count: 1 });
    list.splice(300);
    fs.mkdirSync(path.dirname(JS_ERROR_FILE), { recursive: true });
    const temporary = `${JS_ERROR_FILE}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(list, null, 2));
    fs.renameSync(temporary, JS_ERROR_FILE);
  }
  res.json({ ok: true });
});

app.get('/api/js-error', requireApiKey, (req, res) => {
  const list = loadJsErrors();
  res.json({ total: list.length, errors: list.slice(0, Math.min(Number(req.query.limit) || 100, 300)) });
});

// Explore: sains & geografi (data terbuka, tanpa kunci API)
app.get('/api/explore/earthquakes', async (req, res) => {
  try {
    res.json(await explore.getEarthquakes({
      limit: req.query.limit,
      minMagnitude: req.query.minmagnitude
    }));
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengambil data gempa bumi', details: safeError(error) });
  }
});

app.get('/api/explore/countries', async (req, res) => {
  try {
    res.json(await explore.searchCountries({ q: req.query.q, limit: req.query.limit }));
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengambil data negara', details: safeError(error) });
  }
});

app.get('/api/explore/geocode', async (req, res) => {
  try {
    res.json(await explore.geocode({ q: req.query.q, limit: req.query.limit }));
  } catch (error) {
    res.status(500).json({ error: 'Gagal menggeokod lokasi', details: safeError(error) });
  }
});

app.get('/api/explore/weather', async (req, res) => {
  try {
    res.json(await explore.getWeather({ lat: req.query.lat, lon: req.query.lon, days: req.query.days }));
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: 'Gagal mengambil data cuaca', details: safeError(error) });
  }
});

app.get('/api/explore/sun', async (req, res) => {
  try {
    res.json(await explore.getSunTimes({ lat: req.query.lat, lon: req.query.lon, date: req.query.date }));
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: 'Gagal mengambil waktu matahari', details: safeError(error) });
  }
});

app.get('/api/explore/arxiv', async (req, res) => {
  try {
    res.json(await explore.searchArxiv({ q: req.query.q, limit: req.query.limit }));
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengambil hasil arXiv', details: safeError(error) });
  }
});

app.get('/api/explore/ip', async (req, res) => {
  try {
    res.json(await explore.getIpInfo(req.query.ip));
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: 'Gagal mengenal pasti IP', details: safeError(error) });
  }
});

// Laluan mutasi — perlukan API_KEY (header X-API-Key atau Bearer)
app.post('/crawl', requireApiKey, async (req, res) => {
  try {
    const url = req.body && req.body.url;
    if (!url) return res.status(400).json({ error: 'Parameter "url" diperlukan' });
    res.json(await crawler.crawlOne(url));
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: 'Rayau gagal', details: safeError(error) });
  }
});

app.post('/crawl/batch', requireApiKey, async (req, res) => {
  try {
    const urls = (req.body && req.body.urls) || [];
    if (!Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({ error: 'Medan "urls" mesti sebuah senarai tidak kosong' });
    }
    if (urls.length > 100) return res.status(400).json({ error: 'Maksimum 100 URL setiap permintaan' });
    res.json(await crawler.crawlBatch(urls));
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: 'Rayau pukal gagal', details: safeError(error) });
  }
});

app.post('/crawl/sitemap', requireApiKey, async (req, res) => {
  try {
    const url = req.body && req.body.url;
    if (!url) return res.status(400).json({ error: 'Parameter "url" diperlukan' });
    res.json(await crawler.crawlSitemap(url));
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: 'Rayau sitemap gagal', details: safeError(error) });
  }
});

app.post('/crawl/site', requireApiKey, async (req, res) => {
  try {
    const url = req.body && req.body.url;
    if (!url) return res.status(400).json({ error: 'Parameter "url" diperlukan' });
    const maxPages = Number(req.body.maxPages);
    const options = {};
    if (Number.isFinite(maxPages) && maxPages > 0) options.maxPages = Math.min(maxPages, 200);
    if (req.body.sameDomain === false) options.sameDomain = false;
    res.json(await crawler.crawlSeed(url, options));
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: 'Rayau laman gagal', details: safeError(error) });
  }
});

app.post('/documents', requireApiKey, async (req, res) => {
  try {
    const documents = (req.body && (req.body.documents || req.body)) || [];
    const list = Array.isArray(documents) ? documents : [documents];
    const valid = list.filter((doc) => doc && typeof doc === 'object' && doc.id && doc.content);
    if (!valid.length) {
      return res.status(400).json({ error: 'Setiap dokumen perlu medan "id" dan "content"' });
    }
    const task = await index.addDocuments(valid, { primaryKey: 'id' });
    res.json({ indexed: valid.length, taskUid: task.taskUid });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: 'Indeks dokumen gagal', details: safeError(error) });
  }
});

app.delete('/documents/:id', requireApiKey, async (req, res) => {
  try {
    const task = await index.deleteDocument(req.params.id);
    res.json({ deleted: req.params.id, taskUid: task.taskUid });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: 'Padam dokumen gagal', details: safeError(error) });
  }
});

const SETTINGS_ALLOWLIST = new Set(['searchDefaultLimit', 'synonymsEnabled', 'safeSearch', 'defaultSort', 'resultsPerPage']);

app.post('/settings', requireApiKey, (req, res) => {
  try {
    const updates = req.body && typeof req.body === 'object' ? req.body : {};
    const keys = Object.keys(updates);
    if (!keys.length) return res.status(400).json({ error: 'Tiada tetapan diberikan' });
    const applied = {};
    for (const key of keys) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
      if (!SETTINGS_ALLOWLIST.has(key)) continue;
      applied[key] = store.setSetting(key, updates[key]);
    }
    if (!Object.keys(applied).length) {
      return res.status(400).json({ error: 'Tiada kunci sah diubah', dibenarkan: [...SETTINGS_ALLOWLIST] });
    }
    res.json({ updated: applied });
  } catch (error) {
    res.status(500).json({ error: 'Kemas kini tetapan gagal', details: safeError(error) });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found', path: req.originalUrl });
});

app.use((error, req, res, next) => {
  errorCount += 1;
  if (res.headersSent) return next(error);
  res.status(error.statusCode || 500).json({ error: 'Ralat pelayan', details: safeError(error) });
});

module.exports = { app };