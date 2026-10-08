const files = ['journey-a', 'journey-b', 'tukuk-a', 'tukuk-b', 'extra'];

const map = {};
for (const file of files) {
  for (const item of require(`./articles/${file}`)) {
    if (item.oldSlug && item.oldSlug !== item.slug) map[item.oldSlug] = item.slug;
  }
}

Object.assign(map, {
  'seo-on-page-menulis-kandungan-yang-disenangi-google': 'seo-on-page-content-google-loves',
  'redis-cache-pantas-untuk-aplikasi-web': 'redis-cache-for-fast-web-apps',
  'privasi-dalam-ai-lokal-tiada-data-hantar-ke-awan': 'local-ai-privacy-no-data-to-cloud',
  'panduan-nginx-reverse-proxy-dengan-cloudflare': 'nginx-reverse-proxy-cloudflare-guide',
  'inverted-index-struktur-data-di-sebalik-carian': 'inverted-index-behind-search',
  'http2-dan-http3-quic-panduan-ringkas': 'http2-and-http3-quic-brief-guide',
  'cloudflare-workers-serverless-di-edge': 'cloudflare-workers-serverless-at-edge',
  'cara-crawler-mengumpul-dokumen-untuk-indeks': 'how-crawlers-collect-documents-for-indexing',
  'analitik-web-tanpa-cookie-alternatif-google-analytics': 'cookieless-web-analytics-ga-alternatives',
  'kedaulatan-data-infrastruktur-carian-bebas': 'data-sovereignty-free-search-infrastructure',
  'optimasi-laman-web-seo-asas-dan-teknikal': 'web-optimization-basic-and-technical-seo',
  'memahami-pwa-progressive-web-app': 'understanding-progressive-web-apps',
  'panduan-keselamatan-siber-melindungi-privasi': 'cybersecurity-guide-protecting-your-privacy',
  'masa-depan-ai-enjin-carian-semantik-rag': 'future-of-ai-semantic-search-and-rag',
  'mengenal-meilisearch-enjin-carian-pantas': 'getting-to-know-meilisearch-fast-search-engine',
  'privasi-digital-carian-web-bebas': 'digital-privacy-and-free-web-search',
  'bagaimana-enjin-carian-moden-berfungsi': 'how-modern-search-engines-work',
  'membangun-backup-system-dengan-cloudflare': 'building-a-backup-system-with-cloudflare',
  'panduan-meilisearch-untuk-pemula': 'meilisearch-beginners-guide',
  'cara-tukuk-os-menjadi-enjin-carian-web-bebas': 'how-tukuk-os-became-a-free-web-search-engine'
});

module.exports = map;
