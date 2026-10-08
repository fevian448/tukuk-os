const CACHE_NAME = 'tukuk-os-v3';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/build/icon-192.png',
  '/build/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  // Luar domain: biar pelayar urus sendiri (iklan, CDN imej, dsb.)
  if (url.origin !== self.location.origin) return;

  if (event.request.mode === 'navigate') {
    // HTML: rangkaian dulu supaya pelanggan sentiasa dapat versi terkini.
    // Cache hanya digunakan bila rangkaian gagal (offline).
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Aset statik same-origin (css/js/ikon): rangkaian dulu, cache hanya bila offline.
  // (cache-first menyebabkan CSS basi kelihatan semasa audit/mula sesi baharu.)
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
