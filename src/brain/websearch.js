const http = require('http');
const https = require('https');
const { URL } = require('url');
const zlib = require('zlib');
const config = require('../config');

const cache = new Map();
const CACHE_TTL_MS = config.websearch.cacheSeconds * 1000;

function httpRequest(targetUrl, headers = {}) {
  return new Promise((resolve, reject) => {
    const mod = targetUrl.startsWith('https') ? https : http;
    const req = mod.get(
      {
        hostname: new URL(targetUrl).hostname,
        path: new URL(targetUrl).pathname + new URL(targetUrl).search,
        method: 'GET',
        timeout: config.websearch.timeout,
      headers: {
        'User-Agent': config.websearch.userAgent || 'TukukOS-WebSearch/1.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'identity',
        ...headers
      }
      },
      (res) => {
        const chunks = [];
        const stream = res.headers['content-encoding'] === 'gzip'
          ? res.pipe(zlib.createGunzip())
          : res;
        stream.on('data', (c) => chunks.push(c));
        stream.on('end', () => {
          let buf = Buffer.concat(chunks);
          // Sesetengah API (cth StackExchange) hantar gzip walaupun tiada
          // header Content-Encoding — kesan magic bytes 1f 8b sebagai sandaran.
          if (buf.length > 2 && buf[0] === 0x1f && buf[1] === 0x8b) {
            try { buf = zlib.gunzipSync(buf); } catch { /* biarkan mentah */ }
          }
          resolve({ status: res.statusCode, body: buf.toString('utf-8') });
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('timeout'));
    });
  });
}

function cacheGet(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function cacheSet(key, value) {
  cache.set(key, { at: Date.now(), value });
}

function cleanText(text) {
  return text
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function parseDuckDuckGo(html, query) {
  const results = [];
  
  // DDG HTML version selectors
  const blocks = String(html).match(/<a[^>]+class="[^"]*result__a[^"]*"[^>]*>([\s\S]*?)<\/a>/gi) || [];
  const snippetBlocks = String(html).match(/<a[^>]+class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/gi) || [];
  const urlBlocks = String(html).match(/<a[^>]+class="[^"]*result__url[^"]*"[^>]*>([\s\S]*?)<\/a>/gi) || [];

  for (let i = 0; i < blocks.length; i++) {
    const anchor = blocks[i];
    const titleMatch = anchor.match(/>([\s\S]*?)<\/a>/);
    const hrefMatch = anchor.match(/href="([^"]+)"/);
    if (!titleMatch || !hrefMatch) continue;

    let rawUrl = hrefMatch[1].trim();
    if (rawUrl.startsWith('//')) rawUrl = 'https:' + rawUrl;
    if (!/^https?:\/\//i.test(rawUrl)) continue;

    // DDG often wraps URLs; extract actual destination
    let finalUrl = rawUrl;
    try {
      const urlObj = new URL(rawUrl);
      const dest = urlObj.searchParams.get('uddg');
      if (dest) finalUrl = decodeURIComponent(dest);
    } catch { /* use raw */ }

    const rawTitle = cleanText(titleMatch[1]);
    
    let snippet = '';
    if (snippetBlocks[i]) {
      snippet = cleanText(snippetBlocks[i]);
    }
    
    // If no snippet block, try to get from url block or nearby text
    if (!snippet && urlBlocks[i]) {
      snippet = cleanText(urlBlocks[i]);
    }

    if (results.length >= config.websearch.maxResults) break;
    if (rawTitle && finalUrl) {
      results.push({ title: rawTitle, url: finalUrl, description: snippet, snippet });
    }
  }

  return results;
}

function parseSearX(html, query) {
  const results = [];
  const blocks = String(html).match(/<article[^>]*class="result"[^>]*>[\s\S]*?<\/article>/gi) || [];

  for (const block of blocks) {
    const titleMatch = block.match(/<h[234][^>]*>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!titleMatch) continue;

    const url = titleMatch[1];
    const title = cleanText(titleMatch[2]);
    const snippetMatch = block.match(/<p[^>]+class="content"[^>]*>([\s\S]*?)<\/p>/i);
    const snippet = snippetMatch ? cleanText(snippetMatch[1]) : '';

    if (results.length >= config.websearch.maxResults) break;
    if (title && url) {
      results.push({ title, url, description: snippet, snippet });
    }
  }

  return results;
}

function parseBing(html, query) {
  const results = [];
  const blocks = String(html).match(/<li class="b_algo"[^>]*>[\s\S]*?<\/li>/gi) || [];

  for (const block of blocks) {
    const titleMatch = block.match(/<h2[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h2>/i);
    if (!titleMatch) continue;

    let url = titleMatch[1].replace(/&amp;/g, '&');
    const title = cleanText(titleMatch[2]);

    // Bing redirect URLs
    const uMatch = url.match(/[?&]u=a1([A-Za-z0-9_-]+)/);
    if (uMatch) {
      try {
        const decoded = Buffer.from(uMatch[1], 'base64').toString('utf-8');
        if (decoded.startsWith('http')) url = decoded;
      } catch { /* skip */ }
    }

    const snippetMatch = block.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    const snippet = snippetMatch ? cleanText(snippetMatch[1]) : '';

    if (results.length >= config.websearch.maxResults) break;
    if (title && url) {
      results.push({ title, url, description: snippet, snippet });
    }
  }

  return results;
}

async function searchDuckDuckGo(query) {
  const target = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  try {
    const { status, body } = await httpRequest(target, {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    });

    if (status === 200 && (body.includes('result__a') || body.includes('result__snippet'))) {
      const hits = parseDuckDuckGo(body, query);
      if (hits.length > 0) {
        return { hits, provider: 'duckduckgo' };
      }
    }
  } catch { /* skip */ }
  return null;
}

async function searchSearX(query) {
  const instances = [
    'https://search.sapti.me',
    'https://searx.be',
    'https://searx.fr'
  ];

  for (const instance of instances) {
    try {
      const target = `${instance}/search?q=${encodeURIComponent(query)}&format=json`;
      const { status, body } = await httpRequest(target, {
        'Accept': 'application/json, text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.5'
      });

      if (status === 200) {
        try {
          const json = JSON.parse(body);
          const hits = (json.results || []).slice(0, config.websearch.maxResults).map((r) => ({
            title: r.title || '',
            url: r.url || '',
            description: r.content || r.description || '',
            snippet: r.content || r.description || ''
          }));

          if (hits.length > 0) {
            return { hits, provider: 'searx' };
          }
        } catch { /* skip */ }
      }
    } catch { /* skip */ }
  }

  return null;
}

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'who', 'what', 'when', 'where', 'why', 'how',
  'was', 'are', 'this', 'that', 'from', 'you', 'your', 'will', 'can', 'did',
  'does', 'has', 'have', 'been', 'into', 'about', 'best', 'top'
]);

function looksRelevant(hits, query) {
  let tokens = query.toLowerCase().split(/[^a-z0-9+#.]+/i).filter((t) => t.length >= 3);
  if (tokens.length === 0) return true;
  const nonStop = tokens.filter((t) => !STOPWORDS.has(t));
  if (nonStop.length > 0) tokens = nonStop;
  // Perlukan sekurang-kurangnya 2 kata kunci sepadan (atau 1 jika query
  // hanya satu kata) — halang decoy Bing yang mengandungi kata umum sahaja.
  const needMatches = Math.min(2, tokens.length);
  return hits.some((h) => {
    const hay = `${h.title || ''} ${h.description || ''}`.toLowerCase();
    const matched = tokens.filter((t) => hay.includes(t));
    return matched.length >= needMatches;
  });
}

async function searchBing(query) {
  const browserHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'DNT': '1',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1'
  };
  // English-first: pasaran en-us dulu; kalau tiada keputusan ATAU keputusan
  // nampak tak kena (Bing hantar decoy untuk query bukan Inggeris),
  // cuba sekali lagi tanpa paksaan pasaran.
  const attempts = [
    `${encodeURIComponent(query)}&setmkt=en-us&setlang=en&ensearch=1`,
    encodeURIComponent(query)
  ];
  let sawIrrelevant = false;
  for (const qs of attempts) {
    try {
      const target = `https://www.bing.com/search?q=${qs}`;
      const { body } = await httpRequest(target, browserHeaders);
      if (body.includes('b_algo')) {
        const hits = parseBing(body, query);
        if (hits.length > 0 && looksRelevant(hits, query)) {
          return { hits, provider: 'bing' };
        }
        if (hits.length > 0) sawIrrelevant = true;
      }
    } catch { /* cuba percubaan seterusnya */ }
  }
  // Bing hidup tapi hantar decoy/tak relevan — jangan bazirkan masa
  // rantaian seterusnya (ddg/searx memang disekat dari rangkaian ini);
  // sumber selari (brave/wikipedia/dll) yang akan membawa keputusan.
  if (sawIrrelevant) return { decoy: true };
  return null;
}

/* ============ Enjin selari (fan-out gabungan) ============ */

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9'
};

async function getJson(target, headers = {}) {
  const { status, body } = await httpRequest(target, {
    'Accept': 'application/json',
    'Accept-Language': 'en-US,en;q=0.9',
    ...headers
  });
  if (status !== 200 || !body) throw new Error(`http ${status}`);
  return JSON.parse(body);
}

function parseBrave(html) {
  const hits = [];
  const blocks = String(html).split('data-type="web"').slice(1);
  for (const block of blocks) {
    if (hits.length >= config.websearch.maxResults) break;
    const a = block.match(/<a href="(https?:\/\/[^"]+)" target="_self"/);
    const t = block.match(/<div class="title[^"]*"[^>]*>([\s\S]*?)<\/div>/);
    if (!a || !t) continue;
    const title = cleanText(t[1]);
    if (!title) continue;
    const d = block.match(/<div class="generic-snippet[^"]*"[^>]*>([\s\S]*?)<\/div>/)
      || block.match(/<div class="snippet-description[^"]*"[^>]*>([\s\S]*?)<\/div>/);
    const desc = d ? cleanText(d[1]) : '';
    hits.push({ title, url: a[1], description: desc, snippet: desc });
  }
  return hits;
}

async function searchBrave(query) {
  try {
    const target = `https://search.brave.com/search?q=${encodeURIComponent(query)}`;
    const { status, body } = await httpRequest(target, BROWSER_HEADERS);
    if (status === 200 && body.includes('data-type="web"')) {
      const hits = parseBrave(body);
      if (hits.length > 0) return { hits, provider: 'brave' };
    }
  } catch { /* skip */ }
  return null;
}

async function searchWikipedia(query) {
  try {
    const target = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=4&format=json&utf8=1`;
    const json = await getJson(target, { 'Api-User-Agent': config.websearch.userAgent });
    const hits = ((json.query && json.query.search) || [])
      .filter((r) => r && r.title)
      .map((r) => {
        const desc = cleanText(r.snippet || '');
        return {
          title: r.title,
          url: `https://en.wikipedia.org/wiki/${encodeURIComponent(String(r.title).replace(/ /g, '_'))}`,
          description: desc,
          snippet: desc
        };
      });
    if (hits.length > 0) return { hits, provider: 'wikipedia' };
  } catch { /* skip */ }
  return null;
}

async function searchDuckInstant(query) {
  try {
    const target = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const json = await getJson(target);
    const hits = [];
    if (json.AbstractURL && json.AbstractText) {
      hits.push({
        title: cleanText(json.Heading || query),
        url: json.AbstractURL,
        description: cleanText(json.AbstractText),
        snippet: cleanText(json.AbstractText)
      });
    }
    const topics = [];
    for (const r of json.RelatedTopics || []) {
      if (r.FirstURL && r.Text) topics.push(r);
      else if (r.Topics) topics.push(...r.Topics);
    }
    for (const r of topics) {
      if (hits.length >= 3) break;
      const desc = cleanText(r.Text || '');
      hits.push({ title: desc.split(' - ')[0].slice(0, 90), url: r.FirstURL, description: desc, snippet: desc });
    }
    if (hits.length > 0) return { hits, provider: 'duckduckgo' };
  } catch { /* skip */ }
  return null;
}

const TECHY_RE = /\b(js|javascript|typescript|python|java|rust|golang|node|npm|react|vue|svelte|django|flask|laravel|rails|api|sdk|cli|git|github|gitlab|docker|kubernetes|linux|ubuntu|debian|arch|bash|shell|regex|sql|postgres|mysql|sqlite|mongodb|redis|framework|library|package|install|pip|cargo|composer|compiler|kernel|c\+\+|c#|php|ruby|swift|kotlin|android|ios|html|css|sass|webpack|vite|nextjs|nuxt|json|xml|yaml|http|https|server|backend|frontend|devops|algorithm|debug|exception|code|programming|encode|decode|unicode|utf-8|pointer|thread|async|oauth|jwt|rest|graphql|grpc|websocket|windows|macos|powershell|systemd|nginx|apache|terraform|ansible|prompt|llm|gpt|model|dataset|tensor|pytorch|tensorflow)\b/i;

function looksTechy(query) {
  return TECHY_RE.test(String(query));
}

async function searchStackOverflow(query) {
  try {
    const target = `https://api.stackexchange.com/2.3/search/advanced?order=desc&sort=relevance&q=${encodeURIComponent(query)}&site=stackoverflow&pagesize=5`;
    const json = await getJson(target, { 'Accept-Encoding': 'gzip' });
    const hits = ((json.items) || [])
      .filter((i) => i && i.link && i.title)
      .slice(0, 4)
      .map((i) => {
        const desc = `${i.score || 0} votes${i.is_answered ? ' · answered' : ''} · Stack Overflow`;
        return { title: cleanText(i.title), url: i.link, description: desc, snippet: desc };
      });
    if (hits.length > 0) return { hits, provider: 'stackoverflow' };
  } catch { /* skip */ }
  return null;
}

async function searchGitHub(query) {
  try {
    const target = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&per_page=3`;
    const json = await getJson(target, {
      'User-Agent': config.websearch.userAgent || 'TukukOS-WebSearch/1.0',
      'Accept': 'application/vnd.github+json'
    });
    const hits = ((json.items) || [])
      .filter((i) => i && i.html_url)
      .slice(0, 3)
      .map((i) => {
        const desc = [i.stargazers_count ? `★ ${i.stargazers_count}` : '', i.description || '', 'GitHub']
          .filter(Boolean).join(' · ').slice(0, 240);
        return { title: i.full_name || i.name || i.html_url, url: i.html_url, description: desc, snippet: desc };
      });
    if (hits.length > 0) return { hits, provider: 'github' };
  } catch { /* skip */ }
  return null;
}

async function searchNpm(query) {
  try {
    const target = `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(query)}&size=3`;
    const json = await getJson(target);
    const hits = ((json.objects) || [])
      .filter((o) => o && o.package && o.package.name)
      .slice(0, 3)
      .map((o) => {
        const p = o.package;
        const desc = [p.version ? `v${p.version}` : '', p.description || '', 'npm'].filter(Boolean).join(' · ').slice(0, 240);
        return { title: p.name, url: `https://www.npmjs.com/package/${encodeURIComponent(p.name)}`, description: desc, snippet: desc };
      });
    if (hits.length > 0) return { hits, provider: 'npm' };
  } catch { /* skip */ }
  return null;
}

function dedupeKey(rawUrl) {
  try {
    const u = new URL(rawUrl);
    u.hash = '';
    for (const k of [...u.searchParams.keys()]) {
      if (/^utm_/i.test(k) || k === 'fbclid' || k === 'gclid') u.searchParams.delete(k);
    }
    return (u.hostname.replace(/^www\./, '') + u.pathname.replace(/\/$/, '') + u.search).toLowerCase();
  } catch { return String(rawUrl).replace(/#.*$/, '').toLowerCase(); }
}

function withTimeout(promise, ms) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    Promise.resolve(promise)
      .then((v) => { clearTimeout(timer); resolve(v); })
      .catch(() => { clearTimeout(timer); resolve(null); });
  });
}

// Rantaian teras (failover pantas) vs sumber selari (dilancarkan serentak).
async function search(query) {
  const q = String(query || '').trim();
  if (!q) return { hits: [], total: 0, query: q, provider: null };

  const cacheKey = `web:${q}`;
  const cached = cacheGet(cacheKey);
  if (cached) return { ...cached, query: q };

  const techy = looksTechy(q);
  const secondary = [
    { name: 'brave', fn: () => searchBrave(q), cap: 15 },
    { name: 'wikipedia', fn: () => searchWikipedia(q), cap: 4 },
    { name: 'duckduckgo', fn: () => searchDuckInstant(q), cap: 3 },
    ...(techy ? [
      { name: 'stackoverflow', fn: () => searchStackOverflow(q), cap: 4 },
      { name: 'github', fn: () => searchGitHub(q), cap: 3 },
      { name: 'npm', fn: () => searchNpm(q), cap: 3 }
    ] : [])
  ];

  // Rantaian teras: bing + ddg + searx dilancarkan SERENTAK (fallback tetap
  // tersedia untuk rangkaian lain), pilih yang pertama berjaya mengikut
  // keutamaan; sumber selari (brave/wiki/dll) juga serentak. Dinding masa
  // dihadkan ~3.5s — tak ada lagi rantai berperingkat yang membakar 7s.
  const primaryP = (async () => {
    const candidates = [
      { name: 'bing', p: searchBing(q) },
      { name: 'duckduckgo', p: searchDuckDuckGo(q) },
      { name: 'searx', p: searchSearX(q) }
    ];
    const results = await Promise.all(
      candidates.map((c) => withTimeout(c.p, 3500))
    );
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r && r.hits && r.hits.length > 0) {
        return { hits: r.hits, provider: r.provider || candidates[i].name };
      }
    }
    return null;
  })();

  const [primary, ...secondaryResults] = await Promise.all([
    primaryP,
    ...secondary.map((s) => withTimeout(s.fn(), config.websearch.timeout + 500))
  ]);

  const MAX_MERGED = 45;
  const seen = new Set();
  const hits = [];
  const engines = {};
  const used = [];

  const add = (h, engine) => {
    if (!h || !h.url || hits.length >= MAX_MERGED) return;
    const key = dedupeKey(h.url);
    if (seen.has(key)) return;
    seen.add(key);
    hits.push({ ...h, engine });
    engines[engine] = (engines[engine] || 0) + 1;
  };

  if (primary && primary.hits) {
    for (const h of primary.hits) add(h, primary.provider);
    used.push(primary.provider);
  }
  secondary.forEach((s, i) => {
    const r = secondaryResults[i];
    if (r && r.hits && r.hits.length > 0) {
      for (const h of r.hits.slice(0, s.cap)) add(h, s.name);
      used.push(s.name);
    }
  });

  const final = {
    hits,
    total: hits.length,
    query: q,
    provider: used.length > 0 ? used.join(', ') : null,
    engines
  };
  // Jangan cache keputusan kosong (masalah sementara rangkaian tidak patut
  // melekat selama cacheSeconds penuh).
  if (hits.length > 0) cacheSet(cacheKey, final);
  return final;
}

function clearCache() {
  cache.clear();
}

function cacheStats() {
  return { entries: cache.size, ttlMs: CACHE_TTL_MS };
}

module.exports = { search, clearCache, cacheStats };
