/**
 * media-search.js — Carian imej dan video web.
 *
 * Sumber utama (disokong dari pelayan ini):
 *   1. Imej : Bing Images  (parse atribut m="…murl…")
 *   2. Video: YouTube      (parse ytInitialData → videoRenderer)
 *
 * Fallback: carian web biasa, kemudian cari URL imej / pautan
 * platform video dalam keputusan tersebut.
 */

const https = require('https');
const http = require('http');
const config = require('../config');
const websearch = require('./websearch');

const CACHE = new Map();
const CACHE_TTL = 5 * 60 * 1000;

const BROWSER_UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

function request(url, ua, timeoutMs) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, {
      timeout: timeoutMs || config.websearch.timeout,
      headers: {
        'User-Agent': ua || config.websearch.userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf-8') }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function cacheKey(type, query) {
  return `${type}:${query.toLowerCase().trim()}`;
}

function cacheGet(type, query) {
  const entry = CACHE.get(cacheKey(type, query));
  if (!entry) return null;
  if (Date.now() - entry.at > CACHE_TTL) {
    CACHE.delete(cacheKey(type, query));
    return null;
  }
  return entry.value;
}

function cacheSet(type, query, value) {
  CACHE.set(cacheKey(type, query), { at: Date.now(), value });
}

function decodeAttr(str) {
  return String(str)
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}

function extractImageUrls(text) {
  const urls = [];
  const regex = /https?:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|gif|webp)(?:\?[^\s"'<>]*)?/gi;
  let match;
  while ((match = regex.exec(text)) !== null && urls.length < config.websearch.maxResults) {
    const url = match[0];
    if (!urls.includes(url)) urls.push(url);
  }
  return urls;
}

function extractVideoUrls(text) {
  const platforms = ['youtube.com', 'youtu.be', 'vimeo.com', 'dailymotion.com', 'bilibili.com'];
  const urls = [];
  const regex = /https?:\/\/[^\s"'<>]+/gi;
  let match;
  while ((match = regex.exec(text)) !== null && urls.length < config.websearch.maxResults) {
    const url = match[0];
    if (platforms.some((p) => url.includes(p)) && !urls.includes(url)) {
      urls.push(url);
    }
  }
  return urls;
}

/* ---------- Sumber utama: Bing Images (sokong paging) ---------- */
const BING_PAGE_SIZE = 35;

async function searchImagesBing(query, page = 1) {
  const first = (Math.max(1, page) - 1) * BING_PAGE_SIZE + 1;
  const url = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&form=HDRSC2&first=${first}&count=${BING_PAGE_SIZE}`;
  const { status, body } = await request(url, BROWSER_UA);
  if (status !== 200 || !body) return [];

  const limit = Math.max(config.websearch.maxResults, 36);
  const hits = [];
  const seen = new Set();
  const attrRe = /\sm="([^"]+)"/g;
  let m;
  while ((m = attrRe.exec(body)) !== null && hits.length < limit) {
    let data;
    try { data = JSON.parse(decodeAttr(m[1])); } catch { continue; }
    if (!data || !data.murl) continue;
    const image = data.murl;
    if (!image || seen.has(image)) continue;
    seen.add(image);
    const pageUrl = data.purl && /^https?:\/\//.test(data.purl) ? data.purl : image;
    hits.push({
      type: 'image',
      title: data.t || `${query} — image ${hits.length + 1}`,
      url: pageUrl,
      image,
      thumbnail: data.turl || image,
      width: data.w || 0,
      height: data.h || 0,
      source: hostOf(pageUrl),
      description: `Image result for "${query}".`
    });
  }
  return hits;
}

/* ---------- Sumber utama: YouTube ---------- */
function walkJson(node, key, out) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const v of node) walkJson(v, key, out);
    return;
  }
  if (node[key]) out.push(node[key]);
  for (const v of Object.values(node)) walkJson(v, key, out);
}

async function searchVideosYouTube(query, sp = '') {
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}${sp ? `&sp=${encodeURIComponent(sp)}` : ''}`;
  const { status, body } = await request(url, BROWSER_UA);
  if (status !== 200 || !body) return { hits: [], nextSp: '' };

  const m = body.match(/var ytInitialData = (\{[\s\S]*?\});<\/script>/);
  if (!m) return { hits: [], nextSp: '' };

  let data;
  try { data = JSON.parse(m[1]); } catch { return { hits: [], nextSp: '' }; }

  const renderers = [];
  walkJson(data, 'videoRenderer', renderers);
  const compact = [];
  walkJson(data, 'compactVideoRenderer', compact);

  // Token sambungan untuk halaman seterusnya
  let nextSp = '';
  const conts = [];
  walkJson(data, 'continuationItemRenderer', conts);
  for (const c of conts) {
    const token = c?.continuationCommand?.token || c?.continuationEndpoint?.continuationCommand?.token;
    if (token) { nextSp = token; break; }
  }

  const limit = Math.max(config.websearch.maxResults, 36);
  const hits = [];
  const seenIds = new Set();
  for (const v of [...renderers, ...compact]) {
    if (hits.length >= limit) break;
    if (v.videoId && seenIds.has(v.videoId)) continue;
    if (v.videoId) seenIds.add(v.videoId);
    const id = v.videoId;
    if (!id) continue;
    const title = (v.title && ((v.title.runs || []).map(r => r.text).join('') || v.title.simpleText)) || '';
    if (!title) continue;
    const channel = (v.ownerText && (v.ownerText.runs || []).map(r => r.text).join('')) || '';
    const views = (v.viewCountText && (v.viewCountText.simpleText || (v.shortViewCountText || {}).simpleText)) || '';
    const length = (v.lengthText && v.lengthText.simpleText) || '';
    hits.push({
      type: 'video',
      title,
      url: `https://www.youtube.com/watch?v=${id}`,
      thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      channel,
      views,
      length,
      source: 'youtube.com',
      description: [channel, views, length].filter(Boolean).join(' · ')
    });
  }
  return { hits, nextSp };
}

async function searchImages(query, { page = 1 } = {}) {
  const q = String(query || '').trim();
  if (!q) return { hits: [], total: 0, query: q, page: 1 };

  const cacheKeyPage = `image:${q}:p${page}`;
  const cached = CACHE.get(cacheKeyPage);
  if (cached && Date.now() - cached.at <= CACHE_TTL) return cached.value;

  try {
    const hits = await searchImagesBing(q, page);
    if (hits.length) {
      const result = {
        hits, total: hits.length, query: q, provider: 'bing', page,
        nextPage: hits.length >= 20 ? page + 1 : 0
      };
      // Keputusan lemah (respons separuh siap) tidak disimpan supaya boleh dicuba semula
      if (hits.length >= 5) CACHE.set(cacheKeyPage, { at: Date.now(), value: result });
      return result;
    }
    if (page > 1) return { hits: [], total: 0, query: q, page, nextPage: 0 };
  } catch { /* jatuh ke fallback */ }

  // Fallback: carian web + cari URL imej dalam ringkasan.
  try {
    const webResults = await websearch.search(q);
    const imageUrls = extractImageUrls(webResults.hits.map((h) => `${h.title} ${h.description}`).join(' '));

    const hits = imageUrls.map((url, position) => ({
      type: 'image',
      title: `${q} — imej ${position + 1}`,
      url,
      thumbnail: url,
      image: url,
      source: hostOf(url),
      description: `Imej untuk "${q}" dari carian web.`
    }));

    const result = { hits, total: hits.length, query: q, provider: webResults.provider || 'web' };
    cacheSet('image', q, result);
    return result;
  } catch {
    return { hits: [], total: 0, query: q };
  }
}

async function searchVideos(query, { sp = '' } = {}) {
  const q = String(query || '').trim();
  if (!q) return { hits: [], total: 0, query: q, nextSp: '' };

  const cacheKeyVideo = `video:${q}:${sp || 'p1'}`;
  const cachedV = CACHE.get(cacheKeyVideo);
  if (cachedV && Date.now() - cachedV.at <= CACHE_TTL) return cachedV.value;

  try {
    const { hits, nextSp } = await searchVideosYouTube(q, sp);
    if (hits.length) {
      const result = { hits, total: hits.length, query: q, provider: 'youtube', nextSp };
      if (hits.length >= 3) CACHE.set(cacheKeyVideo, { at: Date.now(), value: result });
      return result;
    }
    if (sp) return { hits: [], total: 0, query: q, nextSp: '' };
  } catch { /* jatuh ke fallback */ }

  // Fallback: carian web + cari pautan platform video.
  try {
    const webResults = await websearch.search(q);
    const videoUrls = extractVideoUrls(webResults.hits.map((h) => `${h.title} ${h.description} ${h.url}`).join(' '));

    const hits = videoUrls.map((url, position) => ({
      type: 'video',
      title: `${q} — video ${position + 1}`,
      url,
      thumbnail: '',
      source: hostOf(url),
      description: `Video untuk "${q}" dari carian web.`
    }));

    const result = { hits, total: hits.length, query: q, provider: webResults.provider || 'web' };
    cacheSet('video', q, result);
    return result;
  } catch {
    return { hits: [], total: 0, query: q };
  }
}


/* ---------- Muzik: iTunes Search API (Apple, rasmi, tanpa kunci) ---------- */
async function fetchJson(url) {
  const { status, body } = await request(url, BROWSER_UA, 8000);
  if (status !== 200 || !body) throw new Error(`HTTP ${status}`);
  return JSON.parse(body);
}

function fmtDuration(ms) {
  if (!ms || ms < 0) return '';
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

async function searchMusicItunes(q, offset = 0) {
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&entity=song&limit=40&offset=${offset}`;
  const data = await fetchJson(url);
  const hits = (data.results || []).map((r) => ({
    type: 'music',
    title: r.trackName || r.collectionName || q,
    artist: r.artistName || '',
    album: r.collectionName || '',
    artwork: String(r.artworkUrl100 || '').replace('100x100bb', '400x400bb'),
    preview: r.previewUrl || '',
    duration: fmtDuration(r.trackTimeMillis),
    url: r.trackViewUrl || r.collectionViewUrl || '',
    source: 'itunes.apple.com',
    description: [r.artistName, r.collectionName].filter(Boolean).join(' \u00b7 ')
  })).filter((h) => h.title);
  const nextOffset = data.resultCount === 40 ? offset + 40 : 0;
  return { hits, nextOffset };
}

/* ---------- Radio: Radio Browser API (komuniti, tanpa kunci) ---------- */
const RADIO_BASES = ['https://all.api.radio-browser.info', 'https://de1.api.radio-browser.info', 'https://nl1.api.radio-browser.info', 'https://at1.api.radio-browser.info'];

async function searchRadioStations(q, skip = 0) {
  const path = q
    ? `/json/stations/search?name=${encodeURIComponent(q)}&is_https=true&hidebroken=true&order=votes&reverse=true&limit=40&skip=${skip}`
    : `/json/stations/topvote/40?is_https=true&hidebroken=true&offset=${skip}`;
  let data = null;
  for (let round = 0; round < 2 && !Array.isArray(data); round++) {
    for (const base of RADIO_BASES) {
      try { data = await fetchJson(base + path); break; } catch { /* cuba cermin seterusnya */ }
    }
    if (!Array.isArray(data) && round === 0) await new Promise((r) => setTimeout(r, 400));
  }
  if (!Array.isArray(data)) throw new Error('radio-browser tidak dapat dihubungi');
  const hits = data.map((s) => ({
    type: 'radio',
    title: s.name || 'Radio',
    url: s.url_resolved || s.url || '',
    favicon: /^https:\/\//.test(s.favicon || '') ? s.favicon : '',
    country: s.country || '',
    codec: s.codec || '',
    bitrate: s.bitrate || 0,
    tags: String(s.tags || '').split(',').filter(Boolean).slice(0, 3),
    votes: s.votes || 0,
    source: 'radio-browser.info',
    description: [s.country, s.codec, s.bitrate ? `${s.bitrate} kbps` : ''].filter(Boolean).join(' \u00b7 ')
  })).filter((h) => h.url);
  const nextSkip = data.length === 40 ? skip + 40 : 0;
  return { hits, nextSkip };
}

async function searchMusic(query, { offset = 0 } = {}) {
  const q = String(query || '').trim();
  if (!q) return { hits: [], total: 0, query: q, nextOffset: 0 };
  const key = `music:${q}:${offset}`;
  const cached = CACHE.get(key);
  if (cached && Date.now() - cached.at <= CACHE_TTL) return cached.value;
  const { hits, nextOffset } = await searchMusicItunes(q, offset);
  const result = { hits, total: hits.length, query: q, provider: 'itunes', nextOffset };
  if (hits.length >= 3) CACHE.set(key, { at: Date.now(), value: result });
  return result;
}

async function searchRadio(query, { skip = 0 } = {}) {
  const q = String(query || '').trim();
  const key = `radio:${q}:${skip}`;
  const cached = CACHE.get(key);
  if (cached && Date.now() - cached.at <= CACHE_TTL) return cached.value;
  const { hits, nextSkip } = await searchRadioStations(q, skip);
  const result = { hits, total: hits.length, query: q, provider: 'radio-browser', nextSkip };
  if (hits.length >= 3) CACHE.set(key, { at: Date.now(), value: result });
  return result;
}

module.exports = { searchImages, searchVideos, searchMusic, searchRadio };
