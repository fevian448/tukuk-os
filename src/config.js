const fs = require('fs');
const path = require('path');

function loadEnvFile() {
  const candidates = [path.join(__dirname, '..', '.env')];
  if (process.env.KILO_ENV_FILE) candidates.unshift(process.env.KILO_ENV_FILE);

  for (const file of candidates) {
    try {
      const content = fs.readFileSync(file, 'utf8');
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const separator = trimmed.indexOf('=');
        if (separator === -1) continue;
        const key = trimmed.slice(0, separator).trim();
        let value = trimmed.slice(separator + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        if (!(key in process.env)) process.env[key] = value;
      }
      return file;
    } catch {
      continue;
    }
  }
  return null;
}

const envFile = loadEnvFile();

function num(value, fallback) {
  if (value === undefined || value === null || String(value).trim() === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bool(value, fallback = false) {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

module.exports = {
  host: process.env.HOST || '0.0.0.0',
  port: num(process.env.PORT, 8000),
  indexName: process.env.MEILI_INDEX || 'halaman_web',

  meili: {
    host: process.env.MEILI_HOST || 'http://127.0.0.1:7700',
    apiKey: process.env.MEILI_MASTER_KEY || '',
    timeout: num(process.env.MEILI_TIMEOUT, 30000)
  },

  crawl: {
    userAgent: process.env.CRAWLER_UA || 'TukukOS-Bot/1.0 (+https://tukuk-os.local/bot)',
    concurrency: num(process.env.CRAWL_CONCURRENCY, 2),
    queueLimit: num(process.env.CRAWL_QUEUE_LIMIT, 10000),
    timeout: num(process.env.CRAWL_TIMEOUT, 25000),
    maxBytes: num(process.env.CRAWL_MAX_BYTES, 5 * 1024 * 1024),
    maxRedirects: num(process.env.CRAWL_MAX_REDIRECTS, 3),
    maxDepth: num(process.env.CRAWL_MAX_DEPTH, 5),
    maxPagesPerSeed: num(process.env.CRAWL_MAX_PAGES, 1000),
    respectRobots: bool(process.env.CRAWL_RESPECT_ROBOTS, true),
    allowPrivateHosts: bool(process.env.CRAWL_ALLOW_PRIVATE, false),
    indexOnCrawl: bool(process.env.INDEX_ON_CRAWL, true),
    crawlDelayMs: num(process.env.CRAWL_DELAY_MS, 1500),
    minWordCount: num(process.env.CRAWL_MIN_WORDS, 100)
  },

  docs: {
    contentChars: num(process.env.CONTENT_CHARS, 12000),
    summaryChars: num(process.env.SUMMARY_CHARS, 400)
  },

  search: {
    defaultLimit: num(process.env.SEARCH_DEFAULT_LIMIT, 20),
    maxLimit: num(process.env.SEARCH_MAX_LIMIT, 100),
    cropLength: num(process.env.SEARCH_CROP_LENGTH, 30),
    highlightPreTag: process.env.SEARCH_PRE_TAG || '<mark>',
    highlightPostTag: process.env.SEARCH_POST_TAG || '</mark>',
    timeoutMs: num(process.env.SEARCH_TIMEOUT_MS, 1000),
    cacheSeconds: num(process.env.SEARCH_CACHE_SECONDS, 60),
    fallbackOnError: bool(process.env.SEARCH_FALLBACK_ON_ERROR, true),
    fallbackOnEmpty: bool(process.env.SEARCH_FALLBACK_ON_EMPTY, true)
  },

  rateLimit: {
    enabled: bool(process.env.RATE_LIMIT_ENABLED, true),
    trustProxy: bool(process.env.RATE_LIMIT_TRUST_PROXY, true),
    searchWindowMs: num(process.env.RATE_LIMIT_SEARCH_WINDOW, 60000),
    searchMax: num(process.env.RATE_LIMIT_SEARCH_MAX, 120),
    writeWindowMs: num(process.env.RATE_LIMIT_WRITE_WINDOW, 60000),
    writeMax: num(process.env.RATE_LIMIT_WRITE_MAX, 10),
    crawlMax: num(process.env.RATE_LIMIT_CRAWL_MAX, 5)
  },

  security: {
    apiKey: process.env.API_KEY || ''
  },

  adsense: {
    enabled: bool(process.env.ADSENSE_ENABLED, true),
    client: process.env.ADSENSE_CLIENT || 'ca-pub-8954948214333501',
    slotTop: process.env.ADSENSE_SLOT_TOP || '2206273113',
    slotInArticle: process.env.ADSENSE_SLOT_IN_ARTICLE || '2206273113',
    slotBottom: process.env.ADSENSE_SLOT_BOTTOM || '2206273113'
  },

  brain: {
    enabled: bool(process.env.BRAIN_ENABLED, true),
    ollamaHost: process.env.OLLAMA_HOST || 'http://127.0.0.1:11434',
    chain: (process.env.LLM_CHAIN || 'smollm:135m,qwen2.5-coder:0.5b')
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean),
    temperature: Number(process.env.LLM_TEMPERATURE ?? 0.2),
    topP: Number(process.env.LLM_TOP_P ?? 0.9),
    maxTokens: num(process.env.LLM_MAX_TOKENS, 120),
    contextWindow: num(process.env.LLM_CONTEXT_WINDOW, 2048),
    seed: num(process.env.LLM_SEED, 42),
    timeout: num(process.env.LLM_TIMEOUT, 30000),
    retrievalLimit: num(process.env.BRAIN_RETRIEVAL_LIMIT, 4),
    snippetChars: num(process.env.BRAIN_SNIPPET_CHARS, 700),
    minConfidence: Number(process.env.BRAIN_MIN_CONFIDENCE ?? 0.35),
    fastMode: bool(process.env.BRAIN_FAST_MODE, true),
    provider: process.env.BRAIN_PROVIDER || 'ollama',
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    groqApiKey: process.env.GROQ_API_KEY || ''
  },

  net: {
    checkIntervalMs: num(process.env.NET_CHECK_INTERVAL, 30000),
    probeUrl: process.env.NET_PROBE_URL || 'https://cloudflare.com/cdn-cgi/trace',
    timeoutMs: num(process.env.NET_PROBE_TIMEOUT, 5000)
  },

  store: {
    path: process.env.STORE_PATH || path.join(__dirname, '..', 'data', 'tukuk-os.json')
  },

  websearch: {
    enabled: bool(process.env.WEBSEARCH_ENABLED, true),
    provider: process.env.WEBSEARCH_PROVIDER || 'duckduckgo',
    timeout: num(process.env.WEBSEARCH_TIMEOUT, 4000),
    maxResults: num(process.env.WEBSEARCH_MAX_RESULTS, 10),
    cacheSeconds: num(process.env.WEBSEARCH_CACHE_SECONDS, 300),
    userAgent: process.env.WEBSEARCH_UA || 'TukukOS-WebSearch/1.0'
  },

  paths: {
    data: process.env.MEILI_DB_PATH || path.join(__dirname, '..', 'meili_data')
  },

  nasa: {
    apiKey: process.env.NASA_API_KEY || 'fmALFBwD70rhld4szo2P3qGezLRgTqWH6vLUh2lb',
    baseUrl: 'https://api.nasa.gov'
  },

  envFile
};