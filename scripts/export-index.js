#!/usr/bin/env node
/**
 * Eksport indeks Meilisearch ke fail JSON gzip (untuk backup).
 *
 *   node scripts/export-index.js <fail-keluaran> [index]
 *
 * Baca dari env: MEILI_HOST, MEILI_MASTER_KEY, MEILI_INDEX.
 * Fail mengandungi settings + statistik + semua dokumen, jadi boleh
 * dipulihkan terus dengan POST ke /indexes/<uid>/documents.
 */

const fs = require('fs');
const zlib = require('zlib');

const MEILI = (process.env.MEILI_HOST || 'http://127.0.0.1:7700').replace(/\/$/, '');
const KEY = process.env.MEILI_MASTER_KEY || '';
const OUT = process.argv[2];
const INDEX = process.argv[3] || process.env.MEILI_INDEX || 'halaman_web';
const PAGE = 1000;

if (!OUT) {
  console.error('guna: node scripts/export-index.js <fail-keluaran> [index]');
  process.exit(1);
}
if (!KEY) {
  console.error('MEILI_MASTER_KEY kosong');
  process.exit(1);
}

function get(pathname) {
  return fetch(`${MEILI}${pathname}`, { headers: { Authorization: `Bearer ${KEY}` } }).then(async (res) => {
    const text = await res.text();
    if (!res.ok) throw new Error(`${pathname} -> ${res.status} ${text.slice(0, 200)}`);
    return JSON.parse(text);
  });
}

async function main() {
  const [settings, stats, health, info] = await Promise.all([
    get(`/indexes/${INDEX}/settings`),
    get(`/indexes/${INDEX}/stats`),
    get(`/health`),
    get(`/indexes/${INDEX}`)
  ]);

  const documents = [];
  for (let offset = 0; ; offset += PAGE) {
    const page = await get(`/indexes/${INDEX}/documents?limit=${PAGE}&offset=${offset}`);
    documents.push(...page.results);
    if (page.results.length < PAGE) break;
    if (documents.length > 500000) break;
  }

  const payload = {
    index: INDEX,
    primaryKey: info.primaryKey || null,
    exportedAt: new Date().toISOString(),
    meilisearch: health,
    settings,
    stats: { numberOfDocuments: stats.numberOfDocuments },
    documents
  };

  fs.writeFileSync(OUT, zlib.gzipSync(JSON.stringify(payload)));
  const size = fs.statSync(OUT).size;
  console.log(`${INDEX}: ${documents.length} dokumen -> ${OUT} (${size} bait)`);
}

main().catch((err) => {
  console.error(`eksport gagal: ${err.message}`);
  process.exit(1);
});
