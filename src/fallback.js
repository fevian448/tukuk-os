/**
 * Fallback carian — digunakan hanya bila Meilisearch tidak boleh dicapai.
 *
 * Mengimplementasikan semula cara mudah yang asal: padanan substring ringkas
 * ke atas cache dokumen dalam memori. Cache itu diisi semasa crawl, jadi
 * enjin kekal berfungsi (ringkas) walaupun index utama rosak.
 *
 * Ini BUKAN pengganti Meilisearch — tiada typo tolerance, tiada facet,
 * tiada ranking. Hanya talian hayati apabila index turun.
 */

const cache = new Map();
const maxEntries = 2000;

function remember(document) {
  if (!document?.id) return;
  cache.set(document.id, {
    id: document.id,
    url: document.url,
    title: document.title || document.url,
    description: document.description || '',
    content: document.content || '',
    siteName: document.siteName || '',
    host: document.host || '',
    lang: document.lang || '',
    type: document.type || '',
    wordCount: document.wordCount || 0,
    publishedAt: document.publishedAt || '',
    crawledAt: document.crawledAt || new Date().toISOString()
  });
  if (cache.size > maxEntries) {
    const oldest = cache.keys().next().value;
    cache.delete(oldest);
  }
}

function score(document, terms) {
  const title = document.title.toLowerCase();
  const description = document.description.toLowerCase();
  const content = document.content.toLowerCase();
  const site = document.siteName.toLowerCase();

  let total = 0;
  for (const term of terms) {
    let points = 0;
    if (title.includes(term)) points += 10;
    if (description.includes(term)) points += 4;
    if (site.includes(term)) points += 2;
    if (content.includes(term)) points += 1;

    const at = title.indexOf(term);
    if (at === 0) points += 8;
    else if (at > 0 && at < 30) points += 3;

    if (points === 0) return 0;
    total += points;
  }
  return total;
}

function snippetFor(document, terms) {
  const text = document.content || document.description;
  if (!text) return document.description || '';

  const lower = text.toLowerCase();
  let at = -1;
  for (const term of terms) {
    const index = lower.indexOf(term);
    if (index !== -1 && (at === -1 || index < at)) at = index;
  }
  if (at === -1) return text.slice(0, 200);

  const start = Math.max(0, at - 80);
  const end = Math.min(text.length, at + 160);
  let slice = text.slice(start, end);

  for (const term of terms) {
    const safe = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    slice = slice.replace(new RegExp(safe, 'gi'), (match) => `<mark>${match}</mark>`);
  }

  return `${start > 0 ? '…' : ''}${slice}${end < text.length ? '…' : ''}`;
}

function search(query, { limit = 20, offset = 0 } = {}) {
  const terms = String(query).toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return { hits: [], total: 0, tookMs: 0 };

  const startedAt = Date.now();
  const scored = [];

  for (const document of cache.values()) {
    const points = score(document, terms);
    if (points > 0) scored.push({ document, points });
  }

  scored.sort((a, b) => b.points - a.points || a.document.title.localeCompare(b.document.title));

  const hits = scored.slice(offset, offset + limit).map(({ document }) => ({
    ...document,
    content: undefined,
    snippet: snippetFor(document, terms),
    highlights: { title: document.title },
    matchedTerms: terms
  }));

  return {
    hits,
    total: scored.length,
    limit,
    offset,
    tookMs: Date.now() - startedAt,
    degraded: true
  };
}

function size() {
  return cache.size;
}

function clear() {
  cache.clear();
}

module.exports = { remember, search, size, clear };