const { Meilisearch } = require('meilisearch');
const config = require('./config');

const client = new Meilisearch({
  host: config.meili.host,
  apiKey: config.meili.apiKey,
  timeout: config.meili.timeout
});

const MALAY_STOP_WORDS = [
  'ada', 'adalah', 'agar', 'akan', 'aku', 'anda', 'antara', 'apa', 'apabila', 'atau',
  'bagai', 'bahawa', 'bagi', 'banyak', 'baru', 'beberapa', 'belum', 'berada', 'boleh',
  'bukan', 'dalam', 'dan', 'dapat', 'daripada', 'dekat', 'demi', 'dengan', 'di', 'dia',
  'dua', 'hanya', 'hingga', 'ia', 'ialah', 'ini', 'itu', 'jadi', 'jika', 'juga', 'kalau',
  'kami', 'kita', 'lagi', 'lain', 'lalu', 'lebih', 'maka', 'mana', 'masih', 'mesti',
  'mungkin', 'namun', 'oleh', 'pada', 'para', 'sangat', 'satu', 'sebab', 'sebuah', 'sedang',
  'sehingga', 'sejak', 'selain', 'semua', 'semuanya', 'serta', 'sesiapa', 'setiap', 'sudah',
  'supaya', 'tanpa', 'tapi', 'telah', 'tentang', 'tersebut', 'tidak', 'untuk', 'walau',
  'yang', ' apabila', 'iaitu', 'kerana'
];

const SYNONYM_GROUPS = [
  ['alamat', 'lokasi', 'tempat', 'taproh'],
  ['syarikat', 'firma', 'perusahaan', 'organisasi'],
  ['telefon', 'nombor telefon', 'no telefon', 'hp'],
  ['harga', 'kos', 'bayaran', 'tarifan'],
  ['log masuk', 'masuk', 'logon', 'sign in'],
  ['cari', 'carian', 'pencarian', 'geledah'],
  ['berita', 'khabar', 'maklumat', 'news'],
  ['perisian', 'aplikasi', 'program'],
  ['laman web', 'lamanweb', 'web', 'lompat']
];

function buildSynonyms(groups) {
  const synonyms = {};
  for (const group of groups) {
    for (const word of group) {
      synonyms[word] = group.filter((item) => item !== word);
    }
  }
  return synonyms;
}

const RANKING_RULES = [
  'words',
  'typo',
  'proximity',
  'attribute',
  'sort',
  'exactness'
];

function settings() {
  return {
    searchableAttributes: ['title', 'headings', 'description', 'content', 'keywords', 'siteName', 'path'],
    displayedAttributes: [
      'id', 'url', 'title', 'description', 'content', 'summary', 'siteName', 'host', 'lang',
      'type', 'section', 'keywords', 'headings', 'image', 'publishedAt', 'crawledAt',
      'wordCount', 'depth', 'path', 'quality'
    ],
    filterableAttributes: ['host', 'lang', 'type', 'section', 'depth', 'wordCount', 'publishedAt', 'crawledAt', 'siteName', 'keywords', 'quality'],
    sortableAttributes: ['publishedAt', 'crawledAt', 'wordCount', 'depth', 'title', 'quality'],
    distinctAttribute: undefined,
    rankingRules: RANKING_RULES,
    stopWords: MALAY_STOP_WORDS,
    synonyms: buildSynonyms(SYNONYM_GROUPS),
    typoTolerance: {
      enabled: true,
      minWordSizeForTypos: { oneTypo: 4, twoTypos: 8 },
      disableOnAttributes: ['path']
    },
    faceting: {
      maxValuesPerFacet: 50,
      sortFacetValuesBy: { '*': 'count' }
    },
    pagination: { maxTotalHits: 5000 },
    searchCutoffMs: config.search.timeoutMs,
    dictionary: ['Jawi', 'SQL', 'API', 'URL', 'HTML', 'CSS', 'PHP', 'NodeJS', 'GitHub', 'YouTube']
  };
}

async function ensureIndex({ logger = console } = {}) {
  const name = config.indexName;

  try {
    await client.getIndex(name);
    logger.log(`[meili] index "${name}" wujud`);
  } catch (error) {
    if (error?.cause?.code === 'index_not_found' || /index_not_found/i.test(error.message || '')) {
      await client.createIndex(name, { primaryKey: 'id' });
      logger.log(`[meili] index "${name}" dicipta`);
    } else {
      throw error;
    }
  }

  const task = await client.index(name).updateSettings(settings());
  await client.tasks.waitForTask(task.taskUid, { timeOutMs: 30000, intervalMs: 100 });
  logger.log('[meili] tetapan carian dikemas kini');
  return client.index(name);
}

async function health() {
  return client.health();
}

module.exports = { client, ensureIndex, health, settings, indexName: config.indexName };