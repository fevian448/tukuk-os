const fs = require('fs');
const path = require('path');
const config = require('./config');

/**
 * Gudang data lokal — JSON dengan tulisan atomik.
 *
 * Digunakan untuk: sejarah carian,-tetapan runtime, dan log peristiwa.
 * Bukan pangkalan data penuh; tujian yang besar, Meilisearch yang mengurusnya.
 */

const MAX_HISTORY = 500;
const MAX_EVENTS = 200;

const defaults = {
  version: 1,
  createdAt: new Date().toISOString(),
  settings: {},
  history: [],
  events: [],
  stats: { searches: 0, asks: 0, crawls: 0, offlineQueries: 0 },
  posts: []
};

let data = null;
let writeTimer = null;
let dirty = false;

function ensureDir() {
  fs.mkdirSync(path.dirname(config.store.path), { recursive: true });
}

function load() {
  if (data) return data;
  try {
    const raw = fs.readFileSync(config.store.path, 'utf8');
    data = { ...defaults, ...JSON.parse(raw) };
  } catch {
    data = { ...defaults };
  }
  return data;
}

function flush() {
  if (!data || !dirty) return;
  ensureDir();
  const temporary = `${config.store.path}.tmp`;
  try {
    fs.writeFileSync(temporary, JSON.stringify(data, null, 2));
    fs.renameSync(temporary, config.store.path);
    dirty = false;
  } catch (error) {
    console.error('[store] gagal tulis:', error.message);
  }
}

function touch() {
  dirty = true;
  if (writeTimer) return;
  writeTimer = setTimeout(() => {
    writeTimer = null;
    flush();
  }, 2000);
  writeTimer.unref?.();
}

function recordSearch(query, { total, tookMs, offline = false }) {
  const store = load();
  store.stats.searches += 1;
  if (offline) store.stats.offlineQueries += 1;
  store.history.unshift({
    at: new Date().toISOString(),
    kind: 'search',
    query: String(query).slice(0, 200),
    total: total ?? 0,
    tookMs: tookMs ?? 0,
    offline
  });
  store.history = store.history.slice(0, MAX_HISTORY);
  touch();
  return store.history[0];
}

function recordAsk(question, { mode, tookMs, sources = 0, offline = false }) {
  const store = load();
  store.stats.asks += 1;
  if (offline) store.stats.offlineQueries += 1;
  store.history.unshift({
    at: new Date().toISOString(),
    kind: 'ask',
    query: String(question).slice(0, 200),
    mode,
    sources,
    tookMs: tookMs ?? 0,
    offline
  });
  store.history = store.history.slice(0, MAX_HISTORY);
  touch();
  return store.history[0];
}

function recordCrawl(url, status) {
  const store = load();
  store.stats.crawls += 1;
  store.events.unshift({ at: new Date().toISOString(), kind: 'crawl', url, status });
  store.events = store.events.slice(0, MAX_EVENTS);
  touch();
}

function event(level, message, data = {}) {
  const store = load();
  store.events.unshift({ at: new Date().toISOString(), level, message, data });
  store.events = store.events.slice(0, MAX_EVENTS);
  touch();
}

function history(limit = 25) {
  return load().history.slice(0, limit);
}

function popularQueries(limit = 10) {
  const counts = new Map();
  for (const entry of load().history) {
    if (entry.kind !== 'search') continue;
    const key = entry.query.toLowerCase().trim();
    if (key.length < 2) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([query, count]) => ({ query, count }));
}

function stats() {
  return { ...load().stats, stored: load().history.length, events: load().events.length };
}

function getSetting(key, fallback = null) {
  const store = load();
  return store.settings[key] ?? fallback;
}

function setSetting(key, value) {
  load().settings[key] = value;
  touch();
  return value;
}

function createPost(post) {
  const store = load();
  const newPost = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    slug: post.slug || post.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60),
    title: post.title,
    content: post.content,
    excerpt: post.excerpt || post.content.slice(0, 200),
    author: post.author || 'Fevian Donald',
    tags: post.tags || [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  store.posts.unshift(newPost);
  touch();
  return newPost;
}

function updatePost(id, updates) {
  const store = load();
  const post = store.posts.find(p => p.id === id);
  if (!post) return null;
  Object.assign(post, updates, { updatedAt: new Date().toISOString() });
  touch();
  return post;
}

function deletePost(id) {
  const store = load();
  const idx = store.posts.findIndex(p => p.id === id);
  if (idx === -1) return false;
  store.posts.splice(idx, 1);
  touch();
  return true;
}

function getPostBySlug(slug) {
  return load().posts.find(p => p.slug === slug) || null;
}

function getPostById(id) {
  return load().posts.find(p => p.id === id) || null;
}

function getAllPosts(limit = 20) {
  return load().posts.slice(0, limit);
}

function clear() {
  data = { ...defaults, createdAt: new Date().toISOString() };
  dirty = true;
  flush();
}

function close() {
  if (writeTimer) {
    clearTimeout(writeTimer);
    writeTimer = null;
  }
  flush();
}

process.on('exit', close);

module.exports = {
  load, flush, close, recordSearch, recordAsk, recordCrawl, event,
  history, popularQueries, stats, getSetting, setSetting, clear,
  createPost, updatePost, deletePost, getPostBySlug, getPostById, getAllPosts
};