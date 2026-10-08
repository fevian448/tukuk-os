const axios = require('axios');

const http = axios.create({
  timeout: 15000,
  headers: { 'User-Agent': 'TukukOS-Explore/1.0 (+https://tukuk.org)' }
});

const cache = new Map();

function getCache(key) {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiresAt) {
    cache.delete(key);
    return null;
  }
  return item.data;
}

function setCache(key, data, ttlMs) {
  cache.set(key, { data, expiresAt: Date.now() + ttlMs });
  if (cache.size > 300) {
    const firstKey = cache.keys().next().value;
    cache.delete(firstKey);
  }
}

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

function num(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clampText(value, max) {
  return String(value || '').trim().slice(0, max);
}

async function fetchJson(url, { params, ttl, key } = {}) {
  const cacheKey = key || url;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  const res = await http.get(url, { params });
  if (res.data !== undefined && ttl) setCache(cacheKey, res.data, ttl);
  return res.data;
}

/**
 * Gempa bumi terkini — USGS (awam, tanpa kunci API).
 */
async function getEarthquakes({ limit = 20, minMagnitude = 0 } = {}) {
  const size = Math.min(Math.max(num(limit, 20), 1), 50);
  const mag = Math.min(Math.max(num(minMagnitude, 0), 0), 10);
  const data = await fetchJson(
    'https://earthquake.usgs.gov/fdsnws/event/1/query',
    {
      params: {
        format: 'geojson',
        starttime: new Date(Date.now() - 7 * 24 * HOUR).toISOString().slice(0, 10),
        orderby: 'time',
        limit: size,
        minmagnitude: mag || undefined
      },
      ttl: 5 * MINUTE,
      key: `quake:${size}:${mag}`
    }
  );

  return (data.features || []).map((feature) => {
    const p = feature.properties || {};
    const coords = (feature.geometry && feature.geometry.coordinates) || [];
    return {
      id: feature.id,
      magnitude: p.mag,
      place: p.place,
      time: p.time ? new Date(p.time).toISOString() : null,
      depth: coords[2] !== undefined ? Math.round(coords[2] * 10) / 10 : null,
      longitude: coords[0],
      latitude: coords[1],
      url: p.url,
      tsunami: !!p.tsunami,
      alert: p.alert || null
    };
  });
}

/**
 * Maklumat negara — World Bank (awam, tanpa kunci API) + FlagCDN.
 */
async function searchCountries({ q = '', limit = 12 } = {}) {
  const query = clampText(q, 60).toLowerCase();
  const size = Math.min(Math.max(num(limit, 12), 1), 50);

  const [meta, population] = await Promise.all([
    fetchJson('https://api.worldbank.org/v2/country', {
      params: { format: 'json', per_page: 400 },
      ttl: 24 * HOUR,
      key: 'wb:countries'
    }),
    fetchJson('https://api.worldbank.org/v2/country/all/indicator/SP.POP.TOTL', {
      params: { format: 'json', date: 2025, per_page: 400 },
      ttl: 24 * HOUR,
      key: 'wb:population'
    })
  ]);

  const populationByIso3 = new Map();
  for (const row of (Array.isArray(population) && population[1]) || []) {
    if (!row || !row.countryiso3code || row.value === null) continue;
    if (!populationByIso3.has(row.countryiso3code)) {
      populationByIso3.set(row.countryiso3code, row.value);
    }
  }

  const rows = ((Array.isArray(meta) && meta[1]) || []).filter(
    (row) => row && row.region && row.region.value !== 'Aggregates'
  );

  const matched = query
    ? rows.filter((row) =>
        [row.name, row.iso2Code, row.id, row.capitalCity, row.region && row.region.value]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query))
      )
    : rows;

  matched.sort(
    (a, b) => (populationByIso3.get(b.id) || 0) - (populationByIso3.get(a.id) || 0)
  );

  return matched.slice(0, size).map((row) => ({
    name: row.name,
    code: row.iso2Code || '',
    iso3: row.id || '',
    capital: row.capitalCity || '',
    region: ((row.region && row.region.value) || '').trim(),
    incomeLevel: ((row.incomeLevel && row.incomeLevel.value) || '').trim(),
    latitude: row.latitude ? Number(row.latitude) : null,
    longitude: row.longitude ? Number(row.longitude) : null,
    population: populationByIso3.get(row.id) || null,
    flag: row.iso2Code ? `https://flagcdn.com/w320/${row.iso2Code.toLowerCase()}.png` : '',
    emojiFlag: row.iso2Code
      ? String.fromCodePoint(
          ...[...row.iso2Code.toUpperCase()].map((c) => 127397 + c.charCodeAt(0))
        )
      : ''
  }));
}

/**
 * Geokod — Open-Meteo Geocoding (awam, tanpa kunci API).
 */
async function geocode({ q = '', limit = 8 } = {}) {
  const query = clampText(q, 80);
  if (!query) return [];
  const size = Math.min(Math.max(num(limit, 8), 1), 20);

  const data = await fetchJson('https://geocoding-api.open-meteo.com/v1/search', {
    params: { name: query, count: size, language: 'en', format: 'json' },
    ttl: 24 * HOUR,
    key: `geo:${query}:${size}`
  });

  return (data.results || []).map((r) => ({
    name: r.name,
    admin1: r.admin1 || '',
    country: r.country || '',
    countryCode: r.country_code || '',
    latitude: r.latitude,
    longitude: r.longitude,
    elevation: r.elevation || null,
    timezone: r.timezone || '',
    population: r.population || null,
    id: r.id
  }));
}

/**
 * Cuaca semasa + ramalan 7 hari — Open-Meteo (awam, tanpa kunci API).
 */
async function getWeather({ lat, lon, days = 5 } = {}) {
  const latitude = num(lat, null);
  const longitude = num(lon, null);
  if (latitude === null || longitude === null) {
    throw Object.assign(new Error('Parameter lat dan lon diperlukan'), { statusCode: 400 });
  }

  const span = Math.min(Math.max(num(days, 5), 1), 7);
  const data = await fetchJson('https://api.open-meteo.com/v1/forecast', {
    params: {
      latitude,
      longitude,
      current: 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m,wind_direction_10m,pressure_msl',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,sunrise,sunset,uv_index_max',
      timezone: 'auto',
      forecast_days: span
    },
    ttl: 10 * MINUTE,
    key: `wx:${latitude}:${longitude}:${span}`
  });

  const daily = data.daily || {};
  const daysOut = (daily.time || []).map((date, i) => ({
    date,
    weatherCode: daily.weather_code ? daily.weather_code[i] : null,
    tempMax: daily.temperature_2m_max ? daily.temperature_2m_max[i] : null,
    tempMin: daily.temperature_2m_min ? daily.temperature_2m_min[i] : null,
    precipitation: daily.precipitation_sum ? daily.precipitation_sum[i] : null,
    precipitationChance: daily.precipitation_probability_max
      ? daily.precipitation_probability_max[i]
      : null,
    sunrise: daily.sunrise ? daily.sunrise[i] : null,
    sunset: daily.sunset ? daily.sunset[i] : null,
    uvIndex: daily.uv_index_max ? daily.uv_index_max[i] : null
  }));

  return {
    latitude: data.latitude,
    longitude: data.longitude,
    timezone: data.timezone,
    elevation: data.elevation,
    current: data.current || {},
    units: data.current_units || {},
    days: daysOut
  };
}

/**
 * Waktu terbit & terbenam — Sunrise-Sunset API (awam, tanpa kunci API).
 */
async function getSunTimes({ lat, lon, date } = {}) {
  const latitude = num(lat, null);
  const longitude = num(lon, null);
  if (latitude === null || longitude === null) {
    throw Object.assign(new Error('Parameter lat dan lon diperlukan'), { statusCode: 400 });
  }

  const data = await fetchJson('https://api.sunrise-sunset.org/json', {
    params: {
      lat: latitude,
      lng: longitude,
      date: clampText(date, 10) || undefined,
      formatted: 0
    },
    ttl: 6 * HOUR,
    key: `sun:${latitude}:${longitude}:${date || 'today'}`
  });

  if (!data || data.status !== 'OK') {
    throw Object.assign(new Error('Sunrise-Sunset API tidak memberi respons sah'), { statusCode: 502 });
  }

  return {
    latitude,
    longitude,
    date: date || new Date().toISOString().slice(0, 10),
    sunrise: data.results.sunrise,
    sunset: data.results.sunset,
    civilTwilightBegin: data.results.civil_twilight_begin,
    civilTwilightEnd: data.results.civil_twilight_end,
    astronomicalTwilightBegin: data.results.astronomical_twilight_begin,
    astronomicalTwilightEnd: data.results.astronomical_twilight_end,
    dayLength: data.results.day_length
  };
}

function decodeXml(value) {
  return String(value || '')
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Kertas penyelidikan — arXiv (awam, tanpa kunci API).
 */
async function searchArxiv({ q = '', limit = 6 } = {}) {
  const query = clampText(q, 160);
  if (!query) return [];
  const size = Math.min(Math.max(num(limit, 6), 1), 20);

  const key = `arxiv:${query}:${size}`;
  let xml = getCache(key);
  if (!xml) {
    const res = await http.get('https://export.arxiv.org/api/query', {
      params: { search_query: `all:${query}`, start: 0, max_results: size, sortBy: 'submittedDate', sortOrder: 'descending' }
    });
    xml = res.data;
    setCache(key, xml, 6 * HOUR);
  }

  const entries = String(xml).split('<entry>').slice(1);
  return entries.slice(0, size).map((chunk) => {
    const pick = (tag) => {
      const match = chunk.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
      return match ? decodeXml(match[1]) : '';
    };
    const id = pick('id');
    const authors = [...chunk.matchAll(/<author>[\s\S]*?<name>([\s\S]*?)<\/name>[\s\S]*?<\/author>/g)]
      .map((m) => decodeXml(m[1]))
      .slice(0, 4);
    const category = chunk.match(/<category[^>]*term="([^"]+)"/);

    return {
      id,
      title: pick('title'),
      summary: pick('summary').slice(0, 400),
      published: pick('published'),
      updated: pick('updated'),
      authors,
      category: category ? category[1] : '',
      link: id,
      pdf: id.replace('/abs/', '/pdf/')
    };
  });
}

/**
 * Geolokasi IP pelawat — ipwho.is (awam, tanpa kunci API).
 */
async function getIpInfo(ip = '') {
  const target = clampText(ip, 45);
  const url = target ? `https://ipwho.is/${encodeURIComponent(target)}` : 'https://ipwho.is/';
  const data = await fetchJson(url, { ttl: 30 * MINUTE, key: `ip:${target || 'self'}` });

  if (data && data.success === false) {
    throw Object.assign(new Error(data.message || 'IP tidak dapat dikenal pasti'), { statusCode: 404 });
  }

  return {
    ip: data.ip,
    type: data.type,
    city: data.city,
    region: data.region,
    country: data.country,
    countryCode: data.country_code,
    latitude: data.latitude,
    longitude: data.longitude,
    timezone: data.timezone,
    isp: data.connection && data.connection.isp,
    asn: data.connection && data.connection.asn,
    flag: data.flag
  };
}

module.exports = {
  getEarthquakes,
  searchCountries,
  geocode,
  getWeather,
  getSunTimes,
  searchArxiv,
  getIpInfo
};
