const config = require('../config');
const { client } = require('../meili');
const { systemPrompt, knowledge } = require('./knowledge');
const provider = require('./provider');
const websearch = require('./websearch');
const { isEcho, extractiveAnswer } = require('./quality');

const index = client.index(config.indexName);

const THINKING_PATTERNS = [
  /\bapa(kan)? (itu|ini)\b/,
  /\bbagaimanakah\b/,
  /\bmengapa\b/,
  /\bbAGA(pa|macara)\b/,
  /\bapa itu\b/,
  /\bmaksud\b/,
  /\bdefine\b/i,
  /\bwhat is\b/i,
  /\bhow does\b/i,
  /\bwhy\b/i,
  /\bexplain\b/i
];

const TUUK_PATTERNS = [
  /\btukuk[\s-]?os\b/i,
  /\baplikasi (ini|tukuk)\b/i,
  /\bantai ni\b/i,
  /\blaman (ini|web ni)\b/i,
  /\bkau (ada|tahu|boleh)\b/i,
  /\bendpoint\b/i,
  /\bapi\b/i
];

/** Cache jawapan supaya model tidak dipanggil semula untuk soalan yang sama. */
const answerCache = new Map();
const CACHE_TTL = 10 * 60 * 1000;
const CACHE_MAX = 200;

function cacheGet(key) {
  const entry = answerCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.at > CACHE_TTL) {
    answerCache.delete(key);
    return null;
  }
  return entry.value;
}

function cacheSet(key, value) {
  if (answerCache.size >= CACHE_MAX) {
    answerCache.delete(answerCache.keys().next().value);
  }
  answerCache.set(key, { at: Date.now(), value });
}

async function retrieve(query, { limit = config.brain.retrievalLimit } = {}) {
  try {
    const result = await index.search(query, {
      limit,
      attributesToCrop: ['content'],
      cropLength: 40,
      attributesToRetrieve: ['url', 'title', 'description', 'siteName', 'host', 'lang', 'wordCount'],
      showRankingScore: true
    });
    const hits = result.hits || [];

    if (hits.length === 0 && config.websearch.enabled) {
      try {
        const webResult = await websearch.search(query);
        if (webResult.hits && webResult.hits.length > 0) {
          return webResult.hits.slice(0, limit).map((hit, idx) => ({
            ...hit,
            _rankingScore: 0,
            source: 'web',
            webRef: idx + 1
          }));
        }
      } catch {
        // abaikan ralat carian web, gunakan hasil tempatan (kosong)
      }
    }

    return hits;
  } catch {
    return [];
  }
}

function isSelfQuestion(query) {
  return TUUK_PATTERNS.some((pattern) => pattern.test(query));
}

function isKnowledgeQuestion(query) {
  return THINKING_PATTERNS.some((pattern) => pattern.test(query));
}

function buildContext(hits) {
  if (hits.length === 0) return '';
  return hits
    .map((hit, position) => {
      const body = hit._formatted?.content || hit.description || '';
      const trimmed = String(body).replace(/<\/?mark>/g, '').slice(0, config.brain.snippetChars);
      const source = hit.source === 'web' ? `[WEB] ${hit.url}` : hit.url;
      const site = hit.siteName || hit.host || (hit.source === 'web' ? new URL(hit.url).hostname : 'tidak diketahui');
      return [
        `[${position + 1}] ${hit.title || source}`,
        `URL: ${source}`,
        `Site: ${site}`,
        trimmed ? `Content: ${trimmed}` : 'Content: (no summary)'
      ].join('\n');
    })
    .join('\n\n');
}

function buildSources(hits) {
  return hits.map((hit, position) => ({
    ref: position + 1,
    title: hit.title,
    url: hit.url,
    siteName: hit.siteName || hit.host || (hit.source === 'web' ? new URL(hit.url).hostname : ''),
    score: hit._rankingScore ?? null,
    source: hit.source || 'local'
  }));
}

const MINIMAL_SYSTEM =
  'You are a search assistant. Answer briefly in English. ' +
  'Use ONLY information in the context. If there is no context, answer "I don\'t know".';

function buildPrompt(question, hits, selfQuestion) {
  const lines = [];

  if (selfQuestion) {
    // Soalan tentang Tukuk-OS: gunakan pengetahuan sistem sahaja.
    lines.push(knowledgeForSelf());
    lines.push(`QUESTION: ${question}`);
    lines.push('Answer in 2-3 English sentences.');
    return lines.join('\n\n');
  }

  lines.push(`QUESTION: ${question}`);

  if (hits.length > 0) {
    lines.push(`SOURCES:\n${buildContext(hits)}`);
    lines.push(
      'Write a 2-4 sentence answer in English using only the sources. ' +
      `Reference sources with numbers [1], [2].`
    );
  } else {
    lines.push(
      'No information in the sources. Answer exactly: "I don\'t know — that information is not in the Tukuk-OS index." ' +
      'Do not make anything up.'
    );
  }

  return lines.join('\n\n');
}

function knowledgeForSelf() {
  // `knowledge` di sini sudah objek pengetahuan (dari destructure di atas).
  return [
    'Tukuk-OS is a web search engine for tukuk.org, ISC license, built with Meilisearch.',
    `Routes: ${knowledge.routes.split('\n').slice(0, 8).join('; ')}`,
    `Brain: ${knowledge.brain.split('\n')[0]}`,
    `Limits: ${knowledge.limits.split('\n')[0]}`,
    `Operations: ${knowledge.operations.split('\n')[0]}`
  ].join('\n');
}

async function ask(question, { limit } = {}) {
  const query = String(question || '').trim();
  if (!query) {
    return { answer: 'Empty question. Type your question.', sources: [], mode: 'empty' };
  }

  const cacheKey = `${query}|${limit || config.brain.retrievalLimit}`;
  const cached = cacheGet(cacheKey);
  if (cached) return { ...cached, mode: cached.mode, cached: true };

  const startedAt = Date.now();
  const selfQuestion = isSelfQuestion(query);
  const hits = selfQuestion ? [] : await retrieve(query, { limit });

  // Soalan tentang Tukuk-OS: gunakan pengetahuan sistem terus — tidak guna LLM.
  // Model 135M parameter terlalu kecil untuk menjawab soalan generale dengan tepat.
  if (selfQuestion) {
    const answer = knowledgeForSelf();
    return {
      question: query,
      answer,
      method: 'knowledge',
      model: 'fixed knowledge (no LLM)',
      tookMs: Date.now() - startedAt,
      sources: [],
      mode: 'self',
      warning: undefined
    };
  }

  const prompt = buildPrompt(query, hits, selfQuestion);

  const system = selfQuestion ? systemPrompt() : MINIMAL_SYSTEM;
  const numPredict = selfQuestion ? config.brain.maxTokens : Math.min(config.brain.maxTokens, 120);

  let answer = '';
  let model = provider.currentModel();
  let rejected = [];

  // Fast mode: skip LLM, return extractive answer immediately
  if (config.brain.fastMode && !selfQuestion) {
    const extracted = hits.length > 0 ? extractiveAnswer(query, hits) : { answer: '', method: 'none' };
    answer = extracted.answer;
    model = 'extractive (no LLM)';
  } else {
    for (const candidate of config.brain.chain) {
      let output;
      try {
        output = await provider.generate(prompt, { system, temperature: config.brain.temperature, numPredict, model: candidate });
      } catch (error) {
        rejected.push({ model: candidate, reason: error.message });
        continue;
      }

      const text = String(output?.response || '').trim();
      model = candidate;

      if (isEcho(text, prompt)) {
        rejected.push({ model: candidate, reason: 'output tidak koheren (mengulang arahan)' });
        continue;
      }

      answer = text;
      break;
    }
  }

  const sources = buildSources(hits);

  // Semua model ditolak — jana jawapan ekstraktif terus daripada sumber.
  let method = 'llm';
  if (!answer) {
    const extracted = hits.length > 0
      ? extractiveAnswer(query, hits)
      : { answer: '', method: 'none' };
    answer = extracted.answer;
    method = extracted.method;
  }

  if (!answer) {
    answer = selfQuestion
      ? `Tukuk-OS is a web search engine for tukuk.org. Use /search to search, or /ask to ask questions.`
      : 'I don\'t know — that information is not in the Tukuk-OS index.';
    method = 'fallback';
  }

  const result = {
    question: query,
    answer,
    method,
    model: method === 'llm' ? model : 'extractive (no LLM)',
    tookMs: Date.now() - startedAt,
    sources,
    rejectedModels: rejected,
    mode: selfQuestion ? 'self' : sources.length > 0 ? (sources.some(s => s.source === 'web') ? 'web' : 'grounded') : 'ungrounded',
    warning:
      sources.length === 0 && !selfQuestion
        ? 'No sources in the index — this answer is not grounded.'
        : rejected.length > 0 && method !== 'llm'
          ? 'The small model failed to give a coherent answer — the answer was generated directly from the sources.'
          : undefined
  };

  cacheSet(cacheKey, result);
  return result;
}

function cacheStats() {
  return { entries: answerCache.size, ttlMs: CACHE_TTL };
}

function clearCache() {
  answerCache.clear();
}

module.exports = { ask, retrieve, isSelfQuestion, isKnowledgeQuestion, cacheStats, clearCache };