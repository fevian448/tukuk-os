#!/usr/bin/env node
/**
 * batch-crawl.js — Rantau ramai URL secara berbercit, catat progres, elakkan ulangan.
 *
 * Guna:
 *   node scripts/batch-crawl.js                           # guna senarai default
 *   node scripts/batch-crawl.js --seeds seeds/example.txt # guna senarai kustom
 *   node scripts/batch-crawl.js --max 2000 --concurrency 8
 *
 * Keperluan:
 *   - tukuk-os berjalan (systemctl --user status tukuk-os)
 *   - API key dalam .env atau env local (jika RATE_LIMIT_ENABLED=true)
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');

const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 8000);
const API_KEY = process.env.API_KEY || '';
const CONCURRENCY = Number(process.env.CRAWL_CONCURRENCY || 4);
const MAX_PAGES_PER_SEED = Number(process.env.CRAWL_MAX_PAGES || 100);
const MAX_TOTAL = Number(process.env.CRAWL_BATCH_MAX_TOTAL || 2000);
const SEEDS_FILE = process.argv.includes('--seeds')
  ? process.argv[process.argv.indexOf('--seeds') + 1]
  : path.join(__dirname, '..', 'seeds', 'default.txt');
const MAX_ARG = Number(process.argv.includes('--max') ? process.argv[process.argv.indexOf('--max') + 1] : MAX_TOTAL);
const CONCURRENCY_ARG = Number(process.argv.includes('--concurrency') ? process.argv[process.argv.indexOf('--concurrency') + 1] : CONCURRENCY);

function request(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { timeout: 15000 }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf-8') });
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function fetchRobots(origin) {
  try {
    const { status, body } = await request(`${origin}/robots.txt`);
    if (status !== 200) return null;
    const rules = { allow: [], disallow: [] };
    let applies = false;
    for (const rawLine of body.split(/\r?\n/)) {
      const line = rawLine.replace(/#.*$/, '').trim();
      if (!line) continue;
      const [rawKey, ...rest] = line.split(':');
      const key = rawKey.trim().toLowerCase();
      const value = rest.join(':').trim();
      if (key === 'user-agent') {
        applies = value.toLowerCase().split(',').some((a) => a.trim() === '*' || a.trim() === 'tukukos-bot');
        continue;
      }
      if (!applies) continue;
      if (key === 'allow') rules.allow.push(value);
      if (key === 'disallow') rules.disallow.push(value);
    }
    if (!rules.allow.length && !rules.disallow.length) rules.allow.push('/');
    return rules;
  } catch {
    return null;
  }
}

function isAllowed(rules, targetUrl) {
  if (!rules) return true;
  const { pathname, search } = new URL(targetUrl);
  const target = `${pathname}${search}`;
  const matchingDisallow = rules.disallow.filter((r) => r && target.startsWith(r));
  const matchingAllow = rules.allow.filter((r) => r && target.startsWith(r));
  if (matchingDisallow.length === 0) return true;
  if (matchingAllow.length === 0) return false;
  return matchingAllow[matchingAllow.length - 1].length >= matchingDisallow[matchingAllow.length - 1].length;
}

async function discoverSitemaps(origin, rules) {
  const candidates = [`${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`];
  const urls = [];
  for (const sitemap of candidates) {
    if (!isAllowed(rules, sitemap)) continue;
    try {
      const { status, body } = await request(sitemap);
      if (status !== 200) continue;
      const matches = body.match(/<loc>([^<]+)<\/loc>/g) || [];
      for (const m of matches) {
        const u = m.replace(/<[^>]+>/g, '').trim();
        if (u && u.startsWith(origin)) urls.push(u);
      }
      if (urls.length > 0) break;
    } catch { /* skip */ }
  }
  return [...new Set(urls)];
}

async function crawlBatch(urls, concurrency) {
  const results = [];
  const queue = [...urls];
  const workers = [];
  const seen = new Set();

  async function worker() {
    while (queue.length > 0 && results.length < MAX_ARG) {
      const url = queue.shift();
      if (!url || seen.has(url)) continue;
      seen.add(url);
      try {
        const body = JSON.stringify({ urls: [url], concurrency: 1 });
        const opts = {
          hostname: HOST, port: PORT, path: '/crawl/batch', method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(API_KEY ? { 'X-API-Key': API_KEY } : {}) },
          timeout: 20000
        };
        const res = await new Promise((resolve, reject) => {
          const req = https.request(opts, (r) => {
            const chunks = [];
            r.on('data', (c) => chunks.push(c));
            r.on('end', () => resolve({ status: r.statusCode, data: Buffer.concat(chunks).toString('utf-8') }));
          });
          req.on('error', reject);
          req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
          req.write(body);
          req.end();
        });
        let parsed;
        try { parsed = JSON.parse(res.data); } catch { parsed = {}; }
        const items = Array.isArray(parsed.results) ? parsed.results : [];
        for (const item of items) {
          results.push(item);
          if (results.length >= MAX_ARG) break;
        }
      } catch { /* skip */ }
    }
  }

  for (let i = 0; i < concurrency; i += 1) {
    workers.push(worker());
  }
  await Promise.all(workers);
  return results;
}

async function main() {
  console.log(`[batch-crawl] memuat senarai biji: ${SEEDS_FILE}`);
  let seeds = [];
  try {
    seeds = fs.readFileSync(SEEDS_FILE, 'utf-8').split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  } catch {
    console.error(`[batch-crawl] FAIL: tidak dapat membaca ${SEEDS_FILE}`);
    process.exit(1);
  }
  console.log(`[batch-crawl] ${seeds.length} biji`);

  const allUrls = [];
  const seen = new Set();
  const robotsCache = new Map();

  for (const seed of seeds) {
    if (allUrls.length >= MAX_ARG) break;
    try {
      const origin = new URL(seed).origin;
      let rules = robotsCache.get(origin);
      if (!rules) {
        rules = await fetchRobots(origin);
        robotsCache.set(origin, rules);
      }
      if (!isAllowed(rules, seed)) {
        console.log(`[batch-crawl] skip (robots) ${seed}`);
        continue;
      }
      if (seen.has(seed)) continue;
      seen.add(seed);
      allUrls.push(seed);
      const sitemapUrls = await discoverSitemaps(origin, rules);
      for (const u of sitemapUrls) {
        if (!isAllowed(rules, u)) continue;
        if (seen.has(u)) continue;
        seen.add(u);
        allUrls.push(u);
        if (allUrls.length >= MAX_ARG) break;
      }
    } catch { /* skip seed */ }
  }

  console.log(`[batch-crawl] ${allUrls.length} URL untuk dirantau`);
  console.log(`[batch-crawl] memulai batch (concurrency=${CONCURRENCY_ARG})...`);
  const startedAt = Date.now();
  const results = await crawlBatch(allUrls, CONCURRENCY_ARG);
  const took = Date.now() - startedAt;
  const indexed = results.filter((r) => r.status === 'indexed').length;
  const unchanged = results.filter((r) => r.status === 'unchanged').length;
  const failed = results.filter((r) => r.status === 'failed').length;
  const skipped = results.filter((r) => r.status === 'skipped').length;
  console.log(`[batch-crawl] selesai dalam ${took}ms | indexed=${indexed} unchanged=${unchanged} failed=${failed} skipped=${skipped}`);
}

main().catch((e) => {
  console.error('[batch-crawl] ERROR:', e.message);
  process.exit(1);
});
