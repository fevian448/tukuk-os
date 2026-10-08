const axios = require('axios');
const config = require('./config');
const { extract } = require('./extract');
const fallback = require('./fallback');
const { assertPublicUrl, documentId, contentHash, normalizeUrl, sameSite } = require('./util');

const stats = {
  queued: 0,
  crawled: 0,
  failed: 0,
  skipped: 0,
  indexed: 0,
  startedAt: Date.now(),
  lastError: null,
  robots: new Map(),
  domainTimestamps: new Map()
};

const http = axios.create({
  timeout: config.crawl.timeout,
  maxRedirects: config.crawl.maxRedirects,
  maxContentLength: config.crawl.maxBytes,
  validateStatus: (status) => status >= 200 && status < 300,
  headers: {
    'User-Agent': config.crawl.userAgent,
    'Accept-Language': 'ms-MY,ms;q=0.9,en;q=0.8'
  },
  decompress: true
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function domainDelay(targetUrl) {
  const origin = new URL(targetUrl).origin;
  const now = Date.now();
  const last = stats.domainTimestamps.get(origin) || 0;
  const delay = Math.max(0, config.crawl.crawlDelayMs - (now - last));
  if (delay > 0) {
    await sleep(delay);
  }
  stats.domainTimestamps.set(origin, Date.now());
}

async function isAllowed(targetUrl) {
  if (!config.crawl.respectRobots) return true;
  const { origin, pathname } = new URL(targetUrl);
  let rules = stats.robots.get(origin);

  if (!rules) {
    rules = { allow: [], disallow: [] };
    try {
      const { data } = await http.get(`${origin}/robots.txt`, { responseType: 'text', timeout: 8000 });
      parseRobots(String(data), rules);
    } catch {
      rules.allow.push('/');
    }
    stats.robots.set(origin, rules);
  }

  const target = `${pathname}${new URL(targetUrl).search}`;
  const matchingDisallow = rules.disallow.filter((rule) => rule && target.startsWith(rule));
  const matchingAllow = rules.allow.filter((rule) => rule && target.startsWith(rule));
  if (matchingDisallow.length === 0) return true;
  if (matchingAllow.length === 0) return false;
  return matchingAllow[matchingAllow.length - 1].length >= matchingDisallow[matchingDisallow.length - 1].length;
}

function parseRobots(text, rules) {
  let applies = false;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const [rawKey, ...rest] = line.split(':');
    const key = rawKey.trim().toLowerCase();
    const value = rest.join(':').trim();

    if (key === 'user-agent') {
      const agents = value.toLowerCase().split(',').map((item) => item.trim());
      applies = agents.some((agent) => agent === '*' || config.crawl.userAgent.toLowerCase().includes(agent));
      continue;
    }
    if (!applies) continue;
    if (key === 'allow') rules.allow.push(value);
    if (key === 'disallow') rules.disallow.push(value);
  }
  if (!rules.allow.length && !rules.disallow.length) rules.allow.push('/');
}

async function fetchDocument(targetUrl) {
  await assertPublicUrl(targetUrl, { allowPrivate: config.crawl.allowPrivateHosts });

  if (!(await isAllowed(targetUrl))) {
    stats.skipped += 1;
    return { status: 'skipped', reason: 'robots.txt', url: targetUrl };
  }

  await domainDelay(targetUrl);

  const { data, headers } = await http.get(targetUrl, { responseType: 'text' });
  const contentType = String(headers['content-type'] || '');
  if (!/text\/html|application\/xhtml|text\/plain/i.test(contentType)) {
    stats.skipped += 1;
    return { status: 'skipped', reason: `content-type ${contentType}`, url: targetUrl };
  }

  const parsed = extract(String(data), targetUrl);
  const hash = contentHash(`${parsed.title}|${parsed.description}|${parsed.content}`);

  // Quality filter
  if (parsed.wordCount < config.crawl.minWordCount) {
    stats.skipped += 1;
    return { status: 'skipped', reason: `low quality (${parsed.wordCount} words)`, url: targetUrl };
  }

  if (!parsed.title || parsed.title.length < 3) {
    stats.skipped += 1;
    return { status: 'skipped', reason: 'no title', url: targetUrl };
  }

  const existing = await index.getDocument(documentId(parsed.url)).catch(() => null);
  if (existing && existing.hash === hash) {
    stats.skipped += 1;
    return { status: 'unchanged', url: parsed.url, id: documentId(parsed.url) };
  }

  return {
    status: 'crawled',
    document: {
      ...parsed,
      id: documentId(parsed.url),
      hash,
      summary: parsed.description,
      crawledAt: new Date().toISOString()
    }
  };
}

let index = null;
function setIndex(value) {
  index = value;
}

async function crawlOne(targetUrl) {
  try {
    const result = await fetchDocument(targetUrl);
    if (result.status === 'crawled' && config.crawl.indexOnCrawl) {
      fallback.remember(result.document);
      let taskUid = null;
      try {
        const task = await index.addDocuments([result.document], { primaryKey: 'id' });
        taskUid = task.taskUid;
      } catch (indexError) {
        stats.lastError = { url: result.url, message: `indeks gagal: ${indexError.message}` };
      }
      stats.indexed += 1;
      stats.crawled += 1;
      return { status: 'crawled', url: result.document.url, id: result.document.id, taskUid, document: result.document };
    }
    return result;
  } catch (error) {
    stats.failed += 1;
    stats.lastError = { url: targetUrl, message: error.message };
    return { status: 'failed', url: targetUrl, error: error.message };
  }
}

async function crawlBatch(urls, { concurrency = config.crawl.concurrency } = {}) {
  const queue = [...new Set(urls)].filter(Boolean);
  if (stats.queued + queue.length > config.crawl.queueLimit) {
    throw Object.assign(new Error('Giliran rayuan penuh'), { statusCode: 429 });
  }
  stats.queued += queue.length;

  const results = [];
  let cursor = 0;

  async function worker() {
    while (cursor < queue.length) {
      const target = queue[cursor++];
      const result = await crawlOne(target);
      stats.queued -= 1;
      results.push(result);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length || 1) }, worker));
  return results;
}

function collectSitemapUrls(xml) {
  const urls = [];
  const blocks = String(xml).match(/<url\b[\s\S]*?<\/url>/gi) || [];
  for (const block of blocks) {
    const loc = block.match(/<loc>\s*([\s\S]*?)\s*<\/loc>/i);
    if (!loc) continue;
    const value = loc[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim();
    if (value) urls.push(value);
    if (urls.length >= 5000) break;
  }
  return urls;
}

async function crawlSitemap(sitemapUrl) {
  await assertPublicUrl(sitemapUrl, { allowPrivate: config.crawl.allowPrivateHosts });
  const { data } = await http.get(sitemapUrl, { responseType: 'text' });
  const body = String(data);

  if (/<urlset/i.test(body)) {
    return collectSitemapUrls(body).slice(0, config.crawl.maxPagesPerSeed);
  }

  const nested = [...body.matchAll(/<sitemap>\s*<loc>([\s\S]*?)<\/loc>/gi)]
    .map((match) => match[1].trim())
    .slice(0, 10);

  const collected = [];
  for (const child of nested) {
    collected.push(...collectSitemapUrls(await http.get(child, { responseType: 'text' }).then((res) => String(res.data))));
    if (collected.length >= config.crawl.maxPagesPerSeed) break;
    await sleep(150);
  }
  return collected.slice(0, config.crawl.maxPagesPerSeed);
}

async function crawlSeed(seedUrl, { maxPages = config.crawl.maxPagesPerSeed, sameDomain = true } = {}) {
  const seen = new Set([normalizeUrl(seedUrl)]);
  const results = [];
  let frontier = [...seen];

  while (frontier.length && results.length < maxPages) {
    const remaining = Math.max(1, maxPages - results.length);
    const batch = frontier.slice(0, remaining);
    frontier = [];

    const processed = await crawlBatch(batch, { concurrency: config.crawl.concurrency });
    results.push(...processed);

    for (const item of processed) {
      if (item.status !== 'crawled' && item.status !== 'unchanged') continue;
      for (const link of item.document?.links || []) {
        if (seen.size >= maxPages * 4) break;
        if (sameDomain && !sameSite(link, item.url)) continue;
        if (seen.has(link)) continue;
        seen.add(link);
        frontier.push(link);
      }
    }

    if (frontier.length) await sleep(120);
  }

  return { seed: seedUrl, discovered: seen.size, results };
}

function snapshot() {
  return {
    queued: stats.queued,
    crawled: stats.crawled,
    failed: stats.failed,
    skipped: stats.skipped,
    indexed: stats.indexed,
    uptimeSeconds: Math.round((Date.now() - stats.startedAt) / 1000),
    lastError: stats.lastError
  };
}

function resetStats() {
  stats.queued = 0;
  stats.crawled = 0;
  stats.failed = 0;
  stats.skipped = 0;
  stats.indexed = 0;
  stats.lastError = null;
  stats.startedAt = Date.now();
}

function stripDocuments(results) {
  return results.map(({ document, ...rest }) => rest);
}

module.exports = {
  crawlOne,
  crawlBatch,
  crawlSitemap,
  crawlSeed,
  isAllowed,
  setIndex,
  stripDocuments,
  snapshot,
  resetStats
};