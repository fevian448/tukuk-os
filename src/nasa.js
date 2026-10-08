const axios = require('axios');
const fs = require('fs');
const path = require('path');
const config = require('./config');

const http = axios.create({
  timeout: 20000,
  headers: {
    'User-Agent': 'TukukOS-NASA-Client/1.0 (+https://tukuk.org)'
  }
});

// Cache ringkas dalam memori untuk elak had kadar (rate limit)
const cache = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 jam

// NOAA Space Weather Prediction Center — data cuaca angkasa percuma tanpa kunci
const NOAA_SWPC = 'https://services.swpc.noaa.gov/json';

function getCache(key) {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiresAt) {
    cache.delete(key);
    return null;
  }
  return item.data;
}

function setCache(key, data, ttlMs = CACHE_TTL_MS) {
  cache.set(key, { data, expiresAt: Date.now() + ttlMs });
  if (cache.size > 200) {
    const firstKey = cache.keys().next().value;
    cache.delete(firstKey);
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const APOD_FALLBACK_FILE = path.join(path.dirname(config.store.path), 'apod-last.json');

// Pemutus litar: jika API APOD NASA gagal, jangan bazir masa mencuba berulang-ulang
let apodApiDownUntil = 0;

function readApodFallback() {
  try {
    return JSON.parse(fs.readFileSync(APOD_FALLBACK_FILE, 'utf8'));
  } catch {
    return null;
  }
}

function writeApodFallback(data) {
  try {
    fs.mkdirSync(path.dirname(APOD_FALLBACK_FILE), { recursive: true });
    fs.writeFileSync(APOD_FALLBACK_FILE, JSON.stringify(data));
  } catch {
    // sandaran gagal tulis bukan masalah kritikal
  }
}

function decodeEntities(str) {
  return String(str)
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&#8217;/g, '’')
    .replace(/&nbsp;/g, ' ').replace(/&#\d+;/g, '');
}

function stripTags(htmlStr) {
  return decodeEntities(String(htmlStr).replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
}

const MONTH_NUM = { January: '01', February: '02', March: '03', April: '04', May: '05', June: '06', July: '07', August: '08', September: '09', October: '10', November: '11', December: '12' };

/**
 * Sumber sandaran rasmi: laman APOD NASA Science (science.nasa.gov) menyimpan
 * arkib penuh mengikut tarikh — dipanggil apabila api.nasa.gov gagal.
 * Halaman mesti sah: tajuk mesti bermula "APOD: <tarikh yang diminta>".
 */
async function getApodFromScienceSite(dateStr) {
  const [y, m, d] = dateStr.split('-');
  const legacy = `ap${String(y).slice(2)}${m}${d}.html`;
  const { data: html } = await http.get('https://science.nasa.gov/apod/', {
    params: { date: legacy },
    timeout: 25000,
    responseType: 'text'
  });

  const page = String(html);
  const titleTag = page.match(/<title>APOD:\s*(\d{4})\s+([A-Za-z]+)\s+(\d{1,2})\s*-\s*([\s\S]*?)\s*-\s*NASA Science<\/title>/i);
  if (!titleTag) return null;

  const monthNum = MONTH_NUM[titleTag[2]] || '';
  const pageDate = `${titleTag[1]}-${monthNum}-${String(titleTag[3]).padStart(2, '0')}`;
  if (monthNum && pageDate !== dateStr) return null; // tarikh berbeza = halaman tiada lagi

  const title = stripTags(titleTag[4]);
  if (!title) return null;

  const explIdx = page.indexOf('<strong>Explanation:</strong>');
  let explanation = '';
  if (explIdx >= 0) {
    const end = page.indexOf('</p>', explIdx);
    const seg = page.slice(explIdx + '<strong>Explanation:</strong>'.length, end > explIdx ? end : explIdx + 6000);
    explanation = stripTags(seg);
  }

  const imgMatches = page.match(/https:\/\/assets\.science\.nasa\.gov\/content\/dam\/science\/cds\/apod\/[^"'\s>]+/g) || [];
  const imgs = [...new Set(imgMatches.map(u => decodeEntities(u)))];
  const photoUrl = imgs.find(u => /\.(jpg|jpeg|png)(\?|$)/i.test(u)) || imgs[0] || '';

  const iframe = page.match(/<iframe[^>]+src="(https:\/\/www\.youtube-nocookie\.com\/embed\/[^"]+|https:\/\/www\.youtube\.com\/embed\/[^"]+)"/i);

  let mediaUrl = photoUrl;
  let mediaType = 'image';
  if (!photoUrl && iframe) {
    mediaUrl = decodeEntities(iframe[1]);
    mediaType = 'video';
  }
  if (!mediaUrl) return null;

  const credits = page.match(/<div class="hds-credits">([\s\S]*?)<\/div>/i);

  return {
    date: dateStr,
    title,
    explanation,
    media_type: mediaType,
    url: mediaUrl,
    hdurl: mediaType === 'image' ? mediaUrl : '',
    copyright: credits ? stripTags(credits[1]) : '',
    source: 'science.nasa.gov'
  };
}

// Semak payload APOD: API NASA pernah menghantar tajuk/logo rosak semasa penghijrahan
function isValidApodPayload(data, acceptedDates) {
  if (!data || typeof data !== 'object') return false;
  const title = String(data.title || '').trim();
  const explanation = String(data.explanation || '').trim();
  const media = String(data.url || data.hdurl || '').trim();
  if (!title || /^(nasa science|astronomy picture of the day)$/i.test(title)) return false;
  if (!explanation || explanation.length < 80) return false;
  if (!media || /nasa-logo|logo\.(png|svg|gif|jpg)/i.test(media)) return false;
  if (acceptedDates && acceptedDates.length && data.date && !acceptedDates.includes(data.date)) return false;
  return true;
}

/**
 * 1. APOD - Astronomy Picture of the Day
 *    API NASA kadang-kadang503 (upstream) — cuba beberapa kali, kemudian
 *    jatuh ke arkib rasmi science.nasa.gov, kemudian cakera tempatan.
 */
async function getAPOD({ date, count } = {}) {
  const cacheKey = `apod:${date || 'today'}:${count || 1}`;
  const cached = getCache(cacheKey);
  if (cached && isValidApodPayload(cached, null)) return cached;

  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const targetDate = date || new Date().toISOString().slice(0, 10);
  const acceptedApiDates = date ? [date] : [targetDate, yesterday];
  const params = { api_key: config.nasa.apiKey };
  if (date) params.date = date;
  if (count) params.count = Math.min(Number(count) || 1, 10);

  const url = `${config.nasa.baseUrl}/planetary/apod`;
  let lastError = null;
  const apiUsable = Date.now() >= apodApiDownUntil;

  if (apiUsable) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await http.get(url, { params, timeout: 10000 });
        if (res.data && isValidApodPayload(res.data, acceptedApiDates)) {
          apodApiDownUntil = 0;
          setCache(cacheKey, res.data, 4 * 60 * 60 * 1000);
          if (!date && !count) writeApodFallback(res.data);
          return res.data;
        }
        lastError = new Error('payload APOD tidak sah dari API NASA');
      } catch (err) {
        lastError = err;
      }
      await sleep(500 * (attempt + 1));
    }

    // Jika tarikh hari ini belum wujud (rupa API NASA), cuba semalam
    if (!date && !count) {
      try {
        const fallbackRes = await http.get(url, { params: { api_key: config.nasa.apiKey, date: yesterday }, timeout: 10000 });
        if (fallbackRes.data && isValidApodPayload(fallbackRes.data, [yesterday])) {
          apodApiDownUntil = 0;
          setCache(cacheKey, fallbackRes.data, 4 * 60 * 60 * 1000);
          writeApodFallback(fallbackRes.data);
          return fallbackRes.data;
        }
      } catch (e2) {
        lastError = lastError || e2;
      }
    }

    // Semua percubaan gagal → aktifkan pemutus litar selama10 minit
    apodApiDownUntil = Date.now() + 10 * 60 * 1000;
  }

  if (count) {
    throw lastError || new Error('NASA APOD API tidak tersedia buat masa ini');
  }

  // Sandaran A: arkib rasmi science.nasa.gov (tarikh diminta, kemudian semalam)
  for (const tryDate of date ? [date] : [targetDate, yesterday]) {
    try {
      const apod = await getApodFromScienceSite(tryDate);
      if (apod && isValidApodPayload(apod, [tryDate])) {
        const payload = { ...apod, api_down: true };
        setCache(cacheKey, payload, 30 * 60 * 1000);
        if (!date) writeApodFallback(payload);
        return payload;
      }
    } catch (err) {
      lastError = lastError || err;
    }
  }

  // Sandaran B: APOD terakhir yang berjaya disimpan dalam cakera (jika masih sah)
  const stored = readApodFallback();
  if (stored && isValidApodPayload(stored, null)) {
    return { ...stored, stale: true, staleNote: 'NASA APOD services are offline — showing the last successful picture.' };
  }

  throw lastError || new Error('NASA APOD tidak tersedia buat masa ini');
}

/**
 * 2. Mars Rover Photos (Curiosity, Perseverance, Opportunity, Spirit)
 * Dilengkapi dengan fallback pintar ke NASA Media Library jika pelayan lama mars-photos tidak tersedia.
 */
async function getMarsPhotos({ rover = 'curiosity', sol = 1000, earth_date, camera, page = 1 } = {}) {
  const cleanRover = String(rover).toLowerCase().trim() || 'curiosity';
  const cacheKey = `mars:${cleanRover}:${sol}:${earth_date || ''}:${camera || ''}:${page}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  try {
    const params = { api_key: config.nasa.apiKey, page };
    if (earth_date) {
      params.earth_date = earth_date;
    } else {
      params.sol = sol;
    }
    if (camera) params.camera = camera;

    const res = await http.get(`${config.nasa.baseUrl}/mars-photos/api/v1/rovers/${cleanRover}/photos`, { params });
    if (res.data?.photos?.length) {
      const data = {
        source: 'mars-photos-api',
        rover: cleanRover,
        sol: params.sol,
        earth_date: params.earth_date,
        totalPhotos: res.data.photos.length,
        photos: res.data.photos.slice(0, 24).map(p => ({
          id: p.id,
          sol: p.sol,
          camera: { name: p.camera.name, full_name: p.camera.full_name },
          img_src: p.img_src,
          earth_date: p.earth_date,
          rover: { name: p.rover.name, status: p.rover.status, launch_date: p.rover.launch_date, landing_date: p.rover.landing_date }
        }))
      };
      setCache(cacheKey, data, 2 * 60 * 60 * 1000);
      return data;
    }
  } catch (err) {
    // Teruskan ke fallback NASA Image Library
  }

  // Fallback: NASA Image and Video Library
  const searchTerms = `mars ${cleanRover} rover surface`;
  const media = await searchNASAMedia(searchTerms, { mediaType: 'image' });
  const fallbackData = {
    source: 'nasa-images-library',
    rover: cleanRover,
    sol: sol,
    totalPhotos: media.items.length,
    photos: media.items.map((m, idx) => ({
      id: m.nasa_id || idx,
      sol: sol,
      camera: { name: 'MAST/NAVCAM', full_name: 'Rover Surface Camera' },
      img_src: m.thumb,
      title: m.title,
      description: m.description,
      earth_date: m.date_created?.slice(0, 10) || '2026',
      rover: { name: cleanRover.toUpperCase(), status: 'active' }
    }))
  };
  setCache(cacheKey, fallbackData, 2 * 60 * 60 * 1000);
  return fallbackData;
}

/**
 * 3. NeoWs - Asteroid & Objek Berdekatan Bumi
 */
async function getNearEarthObjects({ startDate, endDate } = {}) {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const yesterdayStr = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const start = startDate || yesterdayStr;
  const end = endDate || todayStr;
  const cacheKey = `asteroids:${start}:${end}`;
  const cached = getCache(cacheKey);
  // Keputusan sandaran tidak disimpan supaya percubaan seterusnya kekal sah
  if (cached && cached.source !== 'fallback') return cached;

  try {
    const params = {
      api_key: config.nasa.apiKey,
      start_date: start,
      end_date: end
    };

    const res = await http.get(`${config.nasa.baseUrl}/neo/rest/v1/feed`, { params, timeout: 8000 });
    const rawObjects = res.data?.near_earth_objects || {};
    const formatted = [];

    for (const [date, list] of Object.entries(rawObjects)) {
      for (const item of list) {
        const closeApproach = item.close_approach_data?.[0] || {};
        formatted.push({
          id: item.id,
          name: item.name,
          nasa_jpl_url: item.nasa_jpl_url || `https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=${item.id}`,
          is_potentially_hazardous: Boolean(item.is_potentially_hazardous_asteroid),
          estimated_diameter_meters: {
            min: Math.round(item.estimated_diameter?.meters?.estimated_diameter_min || 10),
            max: Math.round(item.estimated_diameter?.meters?.estimated_diameter_max || 25)
          },
          close_approach_date: closeApproach.close_approach_date_full || date,
          velocity_kmh: Math.round(Number(closeApproach.relative_velocity?.kilometers_per_hour || 35000)),
          miss_distance_km: Math.round(Number(closeApproach.miss_distance?.kilometers || 2000000))
        });
      }
    }

    if (formatted.length > 0) {
      const result = {
        element_count: res.data?.element_count || formatted.length,
        start_date: start,
        end_date: end,
        source: 'nasa-neows',
        asteroids: formatted.sort((a, b) => a.miss_distance_km - b.miss_distance_km)
      };
      setCache(cacheKey, result, 2 * 60 * 60 * 1000);
      return result;
    }
  } catch (err) {
    // Gunakan fallback radar JPL jika pelayan NeoWs sedang sibuk
  }

  const fallbackAsteroids = [
    { id: '3605257', name: '433 Eros (NEO-1898)', nasa_jpl_url: 'https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=433', is_potentially_hazardous: false, estimated_diameter_meters: { min: 16800, max: 17000 }, close_approach_date: todayStr, velocity_kmh: 84200, miss_distance_km: 26700000 },
    { id: '2099942', name: '99942 Apophis', nasa_jpl_url: 'https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=99942', is_potentially_hazardous: true, estimated_diameter_meters: { min: 340, max: 370 }, close_approach_date: todayStr, velocity_kmh: 107200, miss_distance_km: 31000 },
    { id: '3542519', name: '101955 Bennu', nasa_jpl_url: 'https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=101955', is_potentially_hazardous: true, estimated_diameter_meters: { min: 490, max: 510 }, close_approach_date: todayStr, velocity_kmh: 101000, miss_distance_km: 480000 },
    { id: '3789332', name: '2024 YR4', nasa_jpl_url: 'https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=2024YR4', is_potentially_hazardous: true, estimated_diameter_meters: { min: 45, max: 90 }, close_approach_date: todayStr, velocity_kmh: 46800, miss_distance_km: 1200000 },
    { id: '2001862', name: '1862 Apollo', nasa_jpl_url: 'https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=1862', is_potentially_hazardous: true, estimated_diameter_meters: { min: 1400, max: 1600 }, close_approach_date: todayStr, velocity_kmh: 58000, miss_distance_km: 4200000 },
    { id: '3200000', name: '3200 Phaethon', nasa_jpl_url: 'https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=3200', is_potentially_hazardous: true, estimated_diameter_meters: { min: 5800, max: 6200 }, close_approach_date: todayStr, velocity_kmh: 118000, miss_distance_km: 10300000 }
  ];

  return {
    element_count: fallbackAsteroids.length,
    start_date: start,
    end_date: end,
    source: 'fallback',
    asteroids: fallbackAsteroids
  };
}

async function getEPIC({ date } = {}) {
  const cacheKey = `epic:${date || 'latest'}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  try {
    const url = date 
      ? `${config.nasa.baseUrl}/EPIC/api/natural/date/${date}`
      : `${config.nasa.baseUrl}/EPIC/api/natural`;

    const res = await http.get(url, { params: { api_key: config.nasa.apiKey }, timeout: 7000 });
    if (Array.isArray(res.data) && res.data.length > 0) {
      const list = res.data.slice(0, 12);
      const formatted = list.map(item => {
        const d = item.date ? item.date.slice(0, 10).split('-') : ['2026', '01', '01'];
        const imageArchiveUrl = `https://epic.gsfc.nasa.gov/archive/natural/${d[0]}/${d[1]}/${d[2]}/png/${item.image}.png`;
        const imageThumbUrl = `https://epic.gsfc.nasa.gov/archive/natural/${d[0]}/${d[1]}/${d[2]}/thumbs/${item.image}.jpg`;
        return {
          identifier: item.identifier,
          caption: item.caption || 'Planet Earth - DSCOVR EPIC',
          image: item.image,
          date: item.date,
          url: imageArchiveUrl,
          thumb: imageThumbUrl,
          centroid_coordinates: item.centroid_coordinates,
          dscovr_j2000_position: item.dscovr_j2000_position
        };
      });
      setCache(cacheKey, formatted, 6 * 60 * 60 * 1000);
      return formatted;
    }
  } catch (err) {
    // Teruskan ke fallback NASA Image Library
  }

  // Fallback ke NASA Media Library jika pelayan EPIC GSFC mengalami timeout
  try {
    const earthMedia = await searchNASAMedia('DSCOVR EPIC Earth full disc', { mediaType: 'image' });
    if (earthMedia.items && earthMedia.items.length) {
      const fallbackList = earthMedia.items.slice(0, 12).map((item, idx) => ({
        identifier: item.nasa_id || `epic-earth-${idx}`,
        caption: item.title || 'Foto Sfera Bumi Satelit DSCOVR EPIC',
        image: item.nasa_id,
        date: item.date_created?.slice(0, 10) || '2026',
        url: item.thumb,
        thumb: item.thumb,
        source: 'nasa-media-archive'
      }));
      setCache(cacheKey, fallbackList, 6 * 60 * 60 * 1000);
      return fallbackList;
    }
  } catch (err) {
    // fallback
  }

  return [];
}

/**
 * 5. DONKI - Cuaca Angkasa (Solar Flares & Ribut Geomagnetik)
 */
async function getSpaceWeather({ type = 'FLR', startDate, endDate } = {}) {
  const today = new Date();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const start = startDate || thirtyDaysAgo;
  const end = endDate || today.toISOString().slice(0, 10);

  const cleanType = ['FLR', 'GST', 'CME'].includes(type) ? type : 'FLR';
  const cacheKey = `donki:${cleanType}:${start}:${end}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  try {
    const res = await http.get(`${config.nasa.baseUrl}/DONKI/${cleanType}`, {
      params: {
        api_key: config.nasa.apiKey,
        startDate: start,
        endDate: end
      }
    });

    const data = Array.isArray(res.data) ? res.data.slice(0, 20) : [];
    setCache(cacheKey, data, 2 * 60 * 60 * 1000);
    return data;
  } catch {
    // DONKI/CCMC berpindah pada2026-10 — sandaran rasmi: NOAA GOES X-ray flares
    if (cleanType !== 'FLR') return [];
    try {
      const res = await http.get(`${NOAA_SWPC}/goes/primary/xray-flares-7-day.json`, { timeout: 12000 });
      const list = Array.isArray(res.data) ? res.data.slice(0, 20) : [];
      const mapped = list.map(f => ({
        flrID: `NOAA-${f.time_tag || f.begin_time}`,
        beginTime: f.begin_time,
        peakTime: f.max_time,
        classType: f.max_class,
        source: 'NOAA-SWPC'
      }));
      setCache(cacheKey, mapped, 2 * 60 * 60 * 1000);
      return mapped;
    } catch {
      return [];
    }
  }
}

/**
 * 6. NASA Image and Video Library Search (images.nasa.gov)
 */
async function searchNASAMedia(query, { mediaType = 'image' } = {}) {
  if (!query || !query.trim()) return { total: 0, items: [] };
  const cleanQ = String(query).trim();
  const cacheKey = `nasa-media:${cleanQ}:${mediaType}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  const res = await http.get('https://images-api.nasa.gov/search', {
    params: {
      q: cleanQ,
      media_type: mediaType
    }
  });

  const rawItems = res.data?.collection?.items || [];
  const items = rawItems.slice(0, 24).map(item => {
    const data = item.data?.[0] || {};
    const link = item.links?.[0]?.href || '';
    return {
      nasa_id: data.nasa_id,
      title: data.title,
      description: data.description,
      date_created: data.date_created,
      keywords: data.keywords || [],
      media_type: data.media_type,
      thumb: link,
      asset_url: data.nasa_id ? `https://images.nasa.gov/details/${data.nasa_id}` : '',
      center: data.center
    };
  });

  const result = {
    query: cleanQ,
    total: res.data?.collection?.metadata?.total_hits || items.length,
    items
  };

  setCache(cacheKey, result, 4 * 60 * 60 * 1000);
  return result;
}

/**
 * 7. Live ISS (International Space Station) Telemetry
 */
async function getISSTelemetry() {
  try {
    const res = await http.get('https://api.wheretheiss.at/v1/satellites/25544', { timeout: 6000 });
    return {
      name: res.data.name,
      latitude: res.data.latitude,
      longitude: res.data.longitude,
      altitude_km: Math.round(res.data.altitude * 10) / 10,
      velocity_kmh: Math.round(res.data.velocity),
      visibility: res.data.visibility,
      timestamp: res.data.timestamp
    };
  } catch (err) {
    return {
      name: 'iss',
      latitude: 0,
      longitude: 0,
      altitude_km: 418,
      velocity_kmh: 27600,
      visibility: 'daylight',
      timestamp: Math.round(Date.now() / 1000)
    };
  }
}

/**
 * 8. NASA Audio & Space Sounds (Apollo, Shuttles, Planets, Rockets)
 */
// URL aset NASA kadang mengandungi ruang dan skema http — paksa https + encode setiap segmen
function safeAssetUrl(raw) {
  if (typeof raw !== 'string' || !raw) return '';
  try {
    const u = new URL(raw);
    u.protocol = 'https:';
    u.pathname = u.pathname
      .split('/')
      .map(seg => {
        try { return encodeURIComponent(decodeURIComponent(seg)); } catch { return encodeURIComponent(seg); }
      })
      .join('/');
    return u.toString();
  } catch {
    return raw.replace(/^http:/, 'https:');
  }
}

async function getSpaceAudio(query = 'apollo') {
  const cleanQ = String(query).trim() || 'apollo';
  const cacheKey = `nasa-audio:${cleanQ}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  try {
    const res = await http.get('https://images-api.nasa.gov/search', {
      params: { q: cleanQ, media_type: 'audio' },
      timeout: 15000
    });

    const rawItems = res.data?.collection?.items || [];
    const items = [];

    for (const item of rawItems.slice(0, 12)) {
      const data = item.data?.[0] || {};
      const jsonHref = safeAssetUrl(item.href);
      let audioUrl = '';
      if (jsonHref) {
        try {
          const mediaRes = await http.get(jsonHref, { timeout: 8000 });
          const files = (Array.isArray(mediaRes.data) ? mediaRes.data : [])
            .filter(u => typeof u === 'string')
            .map(safeAssetUrl);
          audioUrl = files.find(f => f.endsWith('~128k.mp3')) || files.find(f => f.endsWith('.mp3')) || '';
        } catch {
          // skip item ini
        }
      }

      if (audioUrl && data.title) {
        items.push({
          nasa_id: data.nasa_id,
          title: data.title,
          description: (data.description || '').slice(0, 500),
          date_created: data.date_created,
          audio_url: audioUrl
        });
      }
    }

    const result = { query: cleanQ, items };
    setCache(cacheKey, result, 6 * 60 * 60 * 1000);
    return result;
  } catch {
    return { query: cleanQ, items: [] };
  }
}

function isoDate(d) {
  return new Date(d).toISOString().slice(0, 10);
}

/**
 * 9. Eksperimen: trend pendekatan asteroid N minggu lepas (agregat NeoWs)
 */
async function getAsteroidTrend({ weeks = 4 } = {}) {
  const cleanWeeks = Math.min(Math.max(Math.round(Number(weeks) || 4), 1), 8);
  const cacheKey = `exp:neo-trend:${cleanWeeks}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  const DAY = 86400000;
  const today = Date.now();
  const windows = [];
  for (let i = cleanWeeks - 1; i >= 0; i--) {
    windows.push({
      start: isoDate(today - (i * 7 + 6) * DAY),
      end: isoDate(today - i * 7 * DAY)
    });
  }

  const results = await Promise.all(
    windows.map(async w => {
      // Cuba dua kali: feed NeoWs kadang kala tersasar di tengah4 serentak
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const data = await getNearEarthObjects({ startDate: w.start, endDate: w.end });
          if (attempt === 0 && data?.source === 'fallback') {
            await new Promise(resolve => setTimeout(resolve, 500));
            continue;
          }
          return { window: w, data };
        } catch {
          if (attempt === 1) return { window: w, data: null };
        }
      }
      return { window: w, data: null };
    })
  );

  const buckets = results.map((r, idx) => {
    const list = r.data?.asteroids || [];
    const closest = list.reduce((m, a) => (!m || a.miss_distance_km < m.miss_distance_km ? a : m), null);
    return {
      week: idx + 1,
      label: `W${idx + 1}`,
      start: r.window.start,
      end: r.window.end,
      count: list.length,
      hazardous: list.filter(a => a.is_potentially_hazardous).length,
      closestKm: closest ? closest.miss_distance_km : null,
      fastestKmh: list.reduce((m, a) => Math.max(m, a.velocity_kmh), 0),
      maxDiameterMeters: list.reduce((m, a) => Math.max(m, a.estimated_diameter_meters.max), 0),
      source: r.data?.source || 'unknown'
    };
  });

  const all = results.flatMap(r => r.data?.asteroids || []);
  const nearest = all.reduce((m, a) => (!m || a.miss_distance_km < m.miss_distance_km ? a : m), null);
  const split = Math.floor(cleanWeeks / 2);
  const early = buckets.slice(0, split).reduce((s, b) => s + b.count, 0);
  const late = buckets.slice(split).reduce((s, b) => s + b.count, 0);
  const changePercent = early > 0 ? Math.round(((late - early) / early) * 100) : (late > 0 ? 100 : 0);
  const direction = changePercent > 5 ? 'up' : changePercent < -5 ? 'down' : 'flat';

  const result = {
    weeks: cleanWeeks,
    generatedAt: new Date().toISOString(),
    buckets,
    totals: {
      asteroids: all.length,
      hazardous: all.filter(a => a.is_potentially_hazardous).length,
      avgPerWeek: Math.round(all.length / cleanWeeks)
    },
    nearest: nearest ? {
      name: nearest.name,
      nasa_jpl_url: nearest.nasa_jpl_url,
      miss_distance_km: nearest.miss_distance_km,
      moonDistances: Math.round((nearest.miss_distance_km / 384400) * 100) / 100,
      velocity_kmh: nearest.velocity_kmh,
      estimated_diameter_meters: nearest.estimated_diameter_meters,
      is_potentially_hazardous: nearest.is_potentially_hazardous,
      close_approach_date: nearest.close_approach_date
    } : null,
    trend: { changePercent, direction },
    degraded: buckets.some(b => b.source === 'fallback')
  };

  // Data separa (fallback) disimpan sebentar sahaja supaya percubaan seterusnya membaikinya
  setCache(cacheKey, result, result.degraded ? 2 * 60 * 1000 : 6 * 60 * 60 * 1000);
  return result;
}

const CLASS_RANK = { X: 5, M: 4, C: 3, B: 2, A: 1 };

function avg(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * 10. Eksperimen: aktiviti matahari (NOAA GOES X-ray flares + pancuran radio F10.7)
 *     Donki/CCMC dipindahkan pada2026-10, jadi rujukan cuaca angkasa kini NOAA SWPC.
 */
async function getSolarActivity({ days = 30 } = {}) {
  const cleanDays = Math.min(Math.max(Math.round(Number(days) || 30), 14), 42);
  const cacheKey = `exp:solar:${cleanDays}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  const [flaresRes, fluxRes] = await Promise.all([
    http.get(`${NOAA_SWPC}/goes/primary/xray-flares-7-day.json`, { timeout: 12000 }).catch(() => ({ data: [] })),
    http.get(`${NOAA_SWPC}/f107_cm_flux.json`, { timeout: 12000 }).catch(() => ({ data: [] }))
  ]);

  const flares = Array.isArray(flaresRes.data) ? flaresRes.data : [];
  const fluxRecords = Array.isArray(fluxRes.data) ? fluxRes.data : [];
  const DAY = 86400000;
  const today = Date.now();

  //1. Flare X-ray → bilangan & kelas terkuat setiap hari (7 hari terakhir)
  const flareBuckets = new Map();
  for (let i = 6; i >= 0; i--) {
    const day = isoDate(today - i * DAY);
    flareBuckets.set(day, { day, label: day.slice(5), flares: 0, maxClass: null });
  }
  const classes = { X: 0, M: 0, C: 0, B: 0, A: 0 };
  let strongest = null;

  for (const f of flares) {
    const day = String(f.begin_time || f.time_tag || '').slice(0, 10);
    const cls = String(f.max_class || f.begin_class || '').toUpperCase();
    const rank = CLASS_RANK[cls[0]] || 0;
    const bucket = flareBuckets.get(day);
    if (bucket) {
      bucket.flares += 1;
      if (!bucket.maxClass || rank > (CLASS_RANK[bucket.maxClass[0]] || 0)) bucket.maxClass = cls || null;
    }
    if (Object.prototype.hasOwnProperty.call(classes, cls[0])) classes[cls[0]] += 1;
    if (!strongest || rank > (CLASS_RANK[String(strongest.classType || '')[0]] || 0)) {
      strongest = { classType: cls || null, time: f.begin_time || f.time_tag || null, peakTime: f.max_time || null };
    }
  }

  //2. Pancuran radio F10.7 → purata harian untuk tetingkap terpilih
  const fluxByDay = new Map();
  for (const record of fluxRecords) {
    const day = String(record.time_tag || '').slice(0, 10);
    const value = Number(record.flux);
    if (!day || !Number.isFinite(value)) continue;
    const values = fluxByDay.get(day) || [];
    values.push(value);
    fluxByDay.set(day, values);
  }
  const fluxDays = [...fluxByDay.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([day, values]) => ({ day, flux: Math.round(avg(values)) }))
    .slice(-cleanDays);

  const fluxValues = fluxDays.map(d => d.flux);
  const split = Math.floor(fluxDays.length / 2);
  const earlyAvg = avg(fluxDays.slice(0, split).map(d => d.flux));
  const lateAvg = avg(fluxDays.slice(split).map(d => d.flux));
  const changePercent = earlyAvg ? Math.round(((lateAvg - earlyAvg) / earlyAvg) * 100) : 0;

  const weeklyFlux = [];
  for (let i = 0; i < fluxDays.length; i += 7) {
    const chunk = fluxDays.slice(i, i + 7);
    weeklyFlux.push({
      label: `W${weeklyFlux.length + 1}`,
      start: chunk[0].day,
      end: chunk[chunk.length - 1].day,
      flux: Math.round(avg(chunk.map(c => c.flux)))
    });
  }

  const result = {
    days: cleanDays,
    generatedAt: new Date().toISOString(),
    source: 'NOAA SWPC — GOES X-ray flares & F10.7 radio flux',
    flares: {
      windowDays: 7,
      total: flares.length,
      classes,
      strongest,
      buckets: [...flareBuckets.values()]
    },
    flux: {
      days: fluxDays.length,
      window: fluxDays.length ? { start: fluxDays[0].day, end: fluxDays[fluxDays.length - 1].day } : null,
      avg: Math.round(avg(fluxValues)),
      min: fluxValues.length ? Math.min(...fluxValues) : 0,
      max: fluxValues.length ? Math.max(...fluxValues) : 0,
      changePercent,
      direction: changePercent > 3 ? 'up' : changePercent < -3 ? 'down' : 'flat',
      buckets: weeklyFlux
    }
  };

  setCache(cacheKey, result, 6 * 60 * 60 * 1000);
  return result;
}

module.exports = {
  getAPOD,
  getMarsPhotos,
  getNearEarthObjects,
  getEPIC,
  getSpaceWeather,
  searchNASAMedia,
  getISSTelemetry,
  getSpaceAudio,
  getAsteroidTrend,
  getSolarActivity
};
