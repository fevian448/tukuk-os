const config = require('./config');
const rag = require('./brain/rag');
const websearch = require('./brain/websearch');
const { extractiveAnswer } = require('./brain/quality');

const cache = new Map();
const TTL_MS = 30 * 60 * 1000;

// Soalan / query maklumat — bukan navigasi ("facebook login") atau beli-belah.
const QUESTION_RE = /\b(what|who|when|where|why|how|which|is|are|was|were|can|could|do|does|did|will|would|should|explain|define|meaning|difference|compare|tutorial|guide|example)\b/i;

function decodeEntities(s) {
  return String(s || '')
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&hellip;/gi, '…')
    .replace(/&mdash;/gi, '—')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'");
}

function worthAnswering(q) {
  if (q.includes('?')) return true;
  if (QUESTION_RE.test(q)) return true;
  return q.split(/\s+/).length >= 3;
}

// Ekstraktif: pilih ayat terbaik dari sumber sebenar — model LLM kecil
// (smollm:135m/qwen:0.5b) mengarang halusinasi untuk prompt berkonteks,
// jadi kad jawapan guna ekstrak sahaja: pantas, boleh dipercayai, sifar halusinasi.
async function getAnswer(query) {
  const q = String(query || '').trim();
  if (!q) return { answer: null, reason: 'empty' };
  if (!config.websearch.enabled && !config.brain.enabled) return { answer: null, reason: 'disabled' };
  if (!worthAnswering(q)) return { answer: null, reason: 'skip' };

  const key = q.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

  const started = Date.now();
  try {
    // Konteks: indeks tempatan + keputusan web (cache dikongsi dgn tab Web).
    const [localHits, web] = await Promise.all([
      rag.retrieve(q, { limit: 5 }).catch(() => []),
      websearch.search(q).catch(() => null)
    ]);

    const sources = [];
    const seen = new Set();
    for (const h of [...(localHits || []), ...((web && web.hits) || [])]) {
      const url = h.url || '';
      if (!url || seen.has(url)) continue;
      seen.add(url);
      sources.push({
        title: decodeEntities(String(h.title || '')).slice(0, 140),
        description: decodeEntities(String(h.description || h.snippet || '')).slice(0, 400),
        content: decodeEntities(String(h.content || '')).slice(0, 600),
        url
      });
      if (sources.length >= 8) break;
    }
    if (sources.length === 0) {
      const value = { answer: null, reason: 'no-sources' };
      cache.set(key, { at: Date.now(), value });
      return value;
    }

    const extracted = extractiveAnswer(q, sources, 2);
    let body = String(extracted.answer || '');
    let sourceNames = [];
    const m = body.match(/\n\n\(Sources: (.*)\)$/);
    if (m) {
      sourceNames = m[1].split(';').map((s) => s.trim()).filter(Boolean);
      body = body.slice(0, m.index);
    }
    body = body.trim();

    if (!body || extracted.method === 'extractive-fallback-list') {
      const value = { answer: null, reason: 'no-answer' };
      cache.set(key, { at: Date.now(), value });
      return value;
    }

    const value = {
      answer: body.slice(0, 700),
      method: extracted.method,
      sources: sources.length,
      sourceNames: sourceNames.slice(0, 3),
      tookMs: Date.now() - started
    };
    cache.set(key, { at: Date.now(), value });
    return value;
  } catch {
    return { answer: null, reason: 'error' };
  }
}

function cacheStats() {
  return { entries: cache.size, ttlMs: TTL_MS };
}

module.exports = { getAnswer, cacheStats };
