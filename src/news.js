const https = require('https');
const cheerio = require('cheerio');

// Feed RSS/Atom rasmi — senang dijaga, tiada API key.
// HN diasingkan: RSS mereka tolak HTTP/1.1 (419) — guna API Algolia rasmi.
const FEEDS = [
  { name: 'BBC News', url: 'https://feeds.bbci.co.uk/news/rss.xml' },
  { name: 'TechCrunch', url: 'https://techcrunch.com/feed/' },
  { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml' },
  { name: 'NASA', url: 'https://www.nasa.gov/feed/' }
];

const TTL_MS = 15 * 60 * 1000;
const MAX_ITEMS = 300;
const PAGE_SIZE = 20;

let items = [];
let updatedAt = 0;
let refreshing = null;

function fetchText(url, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      {
        hostname: new URL(url).hostname,
        path: new URL(url).pathname + new URL(url).search,
        timeout: timeoutMs,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
          'Accept-Language': 'en-US,en;q=0.9'
        }
      },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          const next = new URL(res.headers.location, url).toString();
          resolve(fetchText(next, timeoutMs));
          return;
        }
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        const chunks = [];
        const stream = res.headers['content-encoding'] === 'gzip'
          ? res.pipe(require('zlib').createGunzip())
          : res;
        stream.on('data', (c) => chunks.push(c));
        stream.on('end', () => {
          let buf = Buffer.concat(chunks);
          if (buf.length > 2 && buf[0] === 0x1f && buf[1] === 0x8b) {
            try { buf = require('zlib').gunzipSync(buf); } catch { /* biarkan mentah */ }
          }
          resolve(buf.toString('utf-8'));
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

function stripHtml(text) {
  return String(text || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#8217;|&#039;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function parseFeed(xml, source) {
  const $ = cheerio.load(xml, { xmlMode: true });
  const nodes = $('item').length > 0 ? $('item') : $('entry');
  const out = [];
  nodes.each((_, el) => {
    const n = $(el);
    const title = stripHtml(n.find('title').first().text()).slice(0, 300);
    let link = n.find('link').first().text().trim();
    if (!link) link = (n.find('link').first().attr('href') || '').trim();
    if (!title || !/^https?:\/\//i.test(link)) return;
    const descRaw = n.find('description').first().text()
      || n.find('summary').first().text()
      || n.find('content').first().text();
    const description = stripHtml(descRaw).slice(0, 400);
    const dateRaw = n.find('pubDate').first().text()
      || n.find('published').first().text()
      || n.find('updated').first().text()
      || n.find('date').first().text();
    const parsed = Date.parse(dateRaw);
    const image = n.find('[url]').first().attr('url') || '';
    out.push({
      title,
      url: link,
      description,
      source,
      publishedAt: Number.isFinite(parsed) ? parsed : 0,
      image: /^https?:\/\//i.test(image) ? image : ''
    });
  });
  return out;
}

async function fetchHackerNews() {
  const target = 'https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=30';
  const json = JSON.parse(await fetchText(target));
  return (json.hits || [])
    .map((h) => ({
      title: String(h.title || '').slice(0, 300),
      url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
      description: h.points ? `${h.points} points · HN discussion` : 'HN discussion',
      source: 'Hacker News',
      publishedAt: Date.parse(h.created_at) || 0,
      image: ''
    }))
    .filter((i) => i.title && /^https?:\/\//i.test(i.url));
}

async function refresh() {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const settled = await Promise.allSettled([
      ...FEEDS.map(async (f) => parseFeed(await fetchText(f.url), f.name)),
      fetchHackerNews()
    ]);
    const merged = [];
    const seen = new Set();
    for (const r of settled) {
      if (r.status !== 'fulfilled') continue;
      for (const it of r.value) {
        const key = it.url.replace(/#.*$/, '');
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push(it);
      }
    }
    if (merged.length > 0) {
      merged.sort((a, b) => b.publishedAt - a.publishedAt);
      items = merged.slice(0, MAX_ITEMS);
      updatedAt = Date.now();
    }
    return items.length;
  })();
  try {
    return await refreshing;
  } finally {
    refreshing = null;
  }
}

async function searchNews(query, { offset = 0, limit = PAGE_SIZE } = {}) {
  const q = String(query || '').trim();

  if (items.length === 0) {
    await refresh().catch(() => {});
  } else if (Date.now() - updatedAt > TTL_MS) {
    // stale-while-revalidate: sajikan cache lama, segar serentak di belakang.
    refresh().catch(() => {});
  }

  let list = items;
  if (q) {
    const tokens = q.toLowerCase().split(/[^a-z0-9+#.]+/i).filter((t) => t.length >= 2);
    if (tokens.length > 0) {
      list = list.filter((it) => {
        const hay = `${it.title} ${it.description} ${it.source}`.toLowerCase();
        return tokens.every((t) => hay.includes(t));
      });
    }
  }

  const total = list.length;
  const hits = list.slice(offset, offset + limit);
  return {
    hits,
    total,
    query: q,
    offset,
    nextOffset: offset + limit < total ? offset + limit : null,
    provider: 'rss',
    feeds: [...FEEDS.map((f) => f.name), 'Hacker News'],
    updatedAt
  };
}

module.exports = { searchNews, refresh };
