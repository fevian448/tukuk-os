#!/usr/bin/env node
/**
 * Import dataset dari fail CSV / JSON / JSONL ke index Meilisearch.
 *
 *   node scripts/import-dataset.js <fail> [--index uji_coba] [--limit 5000] [--drop]
 *
 * Pemetaan lajur automatik (cari padanan dari senarai di bawah). Dokumen
 * disesuaikan dengan skema index `halaman_web` supaya carian, sorotan kata
 * dan penapis facet berfungsi sama seperti indeks web sebenar.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');

const MEILI = (process.env.MEILI_HOST || 'http://127.0.0.1:7700').replace(/\/$/, '');
const KEY = process.env.MEILI_MASTER_KEY || '';
const BATCH = 1000;

const FIELDS = {
  title: ['title', 'headline', 'name', 'judul'],
  content: ['content', 'text', 'body', 'description', 'summary', 'article', 'isi'],
  url: ['url', 'link', 'guid', 'uri', 'permalink'],
  publishedAt: ['pubdate', 'publishedat', 'published', 'date', 'timestamp', 'createdat'],
  lang: ['lang', 'language', 'bahasa'],
  section: ['category', 'section', 'topic', 'class', 'label', 'kategori'],
  keywords: ['keywords', 'tags', 'labels'],
  image: ['image', 'thumbnail', 'img']
};

function request(method, pathname, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(MEILI + pathname);
    const payload = body === undefined ? null : JSON.stringify(body);
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method,
        headers: Object.assign(
          { Authorization: `Bearer ${KEY}` },
          payload ? { 'Content-Type': 'application/json' } : {}
        )
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(data);
          } catch {
            parsed = data;
          }
          if (res.statusCode >= 400) {
            reject(new Error(`${method} ${pathname} -> ${res.statusCode} ${data.slice(0, 300)}`));
          } else {
            resolve(parsed);
          }
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (c !== '\r') field += c;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  const header = rows.shift() || [];
  return rows
    .filter((r) => r.length > 1)
    .map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), r[i] ?? ''])));
}

function parseFile(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const ext = path.extname(file).toLowerCase();
  if (ext === '.jsonl' || ext === '.ndjson') {
    return raw.split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l));
  }
  if (ext === '.json') {
    const data = JSON.parse(raw);
    if (Array.isArray(data)) return data;
    for (const key of ['data', 'articles', 'rows', 'records', 'items']) {
      if (Array.isArray(data[key])) return data[key];
    }
    throw new Error('JSON mesti mengandungi array');
  }
  return parseCsv(raw);
}

function pick(row, names) {
  for (const name of names) {
    const key = Object.keys(row).find((k) => k.toLowerCase().replace(/[_\s-]/g, '') === name);
    if (key && row[key] !== undefined && row[key] !== '') return String(row[key]).trim();
  }
  return '';
}

function words(text) {
  return text.split(/\s+/).filter(Boolean).length;
}

const TRACKING = /^(utm_|at_|fbclid|gclid|igshid|mc_|ref|cmpid|print|output|vero_|olyanon)/i;

function cleanUrl(raw) {
  try {
    const u = new URL(raw.includes('://') ? raw : `https://${raw}`);
    [...u.searchParams.keys()].forEach((k) => {
      if (TRACKING.test(k)) u.searchParams.delete(k);
    });
    u.hash = '';
    return u.toString();
  } catch {
    return raw;
  }
}

function docId(url) {
  return crypto.createHash('sha1').update(url).digest('hex').slice(0, 32);
}

const MS_WORDS = /\b(yang|dan|untuk|dengan|dalam|pada|adalah|kepada|ini|itu|kerana|atau|tidak|akan|boleh|daripada|sebagai|antara)\b/g;
const EN_WORDS = /\b(the|and|for|with|in|on|is|are|was|were|to|of|that|this|from|by|as|has|have|will|their|its)\b/g;

function detectLang(text) {
  const t = ` ${text.toLowerCase()} `;
  const ms = (t.match(MS_WORDS) || []).length;
  const en = (t.match(EN_WORDS) || []).length;
  return ms > en ? 'ms' : 'en';
}

function deriveSection(url, fallback) {
  let seg = [];
  try {
    seg = new URL(url).pathname.split('/').filter(Boolean);
  } catch {
    return fallback;
  }
  if (!seg.length) return fallback;
  if (/^sport/i.test(seg[0])) return 'sport';
  if (/^news/i.test(seg[0])) {
    const topic = (seg[1] || '').split('-')[0].replace(/[0-9]/g, '');
    if (topic && topic !== 'articles') return topic;
  }
  return seg[0].replace(/[^a-z-]/gi, '').toLowerCase() || fallback;
}

function toDoc(row, index) {
  const title = pick(row, FIELDS.title) || 'Tanpa tajuk';
  const content = pick(row, FIELDS.content) || '';
  const urlRaw = pick(row, FIELDS.url);
  const published = pick(row, FIELDS.publishedAt);
  const forcedLang = pick(row, FIELDS.lang).toLowerCase();
  const sectionRaw = pick(row, FIELDS.section).toLowerCase() || 'lain';

  let host = 'dataset.local';
  let url = urlRaw ? cleanUrl(urlRaw) : '';
  try {
    if (url) host = new URL(url).hostname.replace(/^www\./, '');
  } catch {
    url = urlRaw;
  }
  if (!url) url = `dataset://${index}/${encodeURIComponent(title)}`;

  const lang = forcedLang || detectLang(`${title} ${content}`);
  const section = deriveSection(url, sectionRaw);
  const text = `${title}\n${content}`.trim();
  return {
    id: docId(url),
    url,
    title,
    description: content.slice(0, 300) || title,
    content: content.slice(0, 6000),
    summary: content.slice(0, 200),
    siteName: host,
    host,
    lang,
    type: 'article',
    section,
    keywords: pick(row, FIELDS.keywords) || section,
    headings: title,
    image: pick(row, FIELDS.images || FIELDS.image) || null,
    publishedAt: published ? new Date(published).toISOString() : null,
    crawledAt: new Date().toISOString(),
    wordCount: words(text),
    depth: 0,
    path: (() => {
      try {
        return new URL(url).pathname;
      } catch {
        return '/';
      }
    })()
  };
}

async function ensureIndex(uid) {
  const indexes = await request('GET', '/indexes?limit=100');
  const found = indexes.results.find((i) => i.uid === uid);
  if (!found) {
    await request('POST', '/indexes', { uid, primaryKey: 'id' });
    await new Promise((r) => setTimeout(r, 900));
  }
  await request('PATCH', `/indexes/${uid}/settings`, {
    searchableAttributes: ['title', 'headings', 'description', 'content', 'keywords', 'siteName', 'path'],
    filterableAttributes: ['host', 'lang', 'type', 'section', 'wordCount', 'publishedAt', 'siteName', 'keywords'],
    sortableAttributes: ['crawledAt', 'publishedAt', 'title', 'wordCount'],
    rankingRules: ['words', 'typo', 'proximity', 'attribute', 'sort', 'exactness'],
    stopWords: ['yang', 'dan', 'di', 'ke', 'dari', 'untuk', 'dengan', 'pada', 'adalah', 'ini', 'itu'],
    synonyms: {
      carian: ['search', 'cari', 'pencarian'],
      enjin: ['engine', 'search engine'],
      'web search': ['carian web', 'search the web']
    }
  });
}

async function main() {
  const args = process.argv.slice(2);
  if (!args.length) {
    console.log('guna: node scripts/import-dataset.js <fail> [--index uji_coba] [--limit 5000] [--drop]');
    process.exit(1);
  }
  const file = args[0];
  const opt = (name, fallback) => {
    const i = args.indexOf(name);
    return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
  };
  const uid = opt('--index', 'uji_coba');
  const limit = Number(opt('--limit', 0));
  const drop = args.includes('--drop');

  if (!fs.existsSync(file)) {
    console.error(`fail tidak dijumpai: ${file}`);
    process.exit(1);
  }

  await ensureIndex(uid);
  if (drop) {
    try {
      await request('DELETE', `/indexes/${uid}`);
      await new Promise((r) => setTimeout(r, 900));
      await ensureIndex(uid);
      console.log(`index ${uid} dibuang dan dicipta semula`);
    } catch (e) {
      console.log(`buang index gagal: ${e.message}`);
    }
  }

  const rows = parseFile(file);
  const docs = rows.slice(0, limit || rows.length).map((row) => toDoc(row, uid));
  const unique = new Set(docs.map((d) => d.id));
  console.log(`baris: ${rows.length} | dokumen unik: ${unique.size}`);

  let indexed = 0;
  for (let i = 0; i < docs.length; i += BATCH) {
    const chunk = docs.slice(i, i + BATCH);
    await request('POST', `/indexes/${uid}/documents`, chunk);
    indexed += chunk.length;
    process.stdout.write(`\rhantar ${indexed}/${docs.length}`);
  }

  console.log('\nmenunggu pengindeksan...');
  let stats;
  for (let i = 0; i < 120; i += 1) {
    await new Promise((r) => setTimeout(r, 1000));
    stats = await request('GET', `/indexes/${uid}/stats`);
    if (!stats.isIndexing) break;
  }
  console.log(`index ${uid}: ${stats.numberOfDocuments} dokumen (unik dihantar: ${unique.size})`);
  const failed = await request('GET', '/tasks?statuses=failed&limit=1');
  if (failed.total) console.log(`nota: ${failed.total} tugas gagal sebelum ini boleh diabaikan jika angka di atas betul`);
}

main().catch((err) => {
  console.error(`RALAT: ${err.message}`);
  process.exit(1);
});
