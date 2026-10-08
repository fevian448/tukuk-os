const config = require('./src/config');
const { ensureIndex, health } = require('./src/meili');
const crawler = require('./src/crawler');
const net = require('./src/net');
const store = require('./src/store');
const { app } = require('./src/server');
const news = require('./src/news');
const queries = require('./src/queries');

async function waitForMeili({ attempts = 30, delayMs = 1000 } = {}) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const status = await health();
      if (status.status === 'available') return;
    } catch {
      if (attempt === attempts) {
        throw new Error(`Meilisearch tidak dapat dicapai di ${config.meili.host}. Pastikan ia berjalan.`);
      }
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
}

async function main() {
  console.log('[tukuk-os] memulakan enjin carian...');
  store.load();
  net.start();
  const logged = queries.loadRecent();
  if (logged > 0) console.log(`[queries] ${logged} log carian dimuatkan`);

  net.onChange((state) => {
    store.event('info', `rangkaian -> ${state.status}`);
  });

  let index = null;
  try {
    await waitForMeili();
    console.log(`[meili] terhubung ke ${config.meili.host}`);
    index = await ensureIndex();
    crawler.setIndex(index);
    console.log(`[meili] index sedia: ${config.indexName}`);
  } catch (error) {
    // Jangan mati — enjin carian masih boleh menjawab daripada cache fallback.
    console.warn(`[tukuk-os] AMARAN: ${error.message}`);
    console.warn('[tukuk-os] carian akan guna mod fallback sehingga Meilisearch pulih.');
  }

  const server = app.listen(config.port, config.host, () => {
    console.log(`[tukuk-os] enjin carian berjalan di http://${config.host}:${config.port}`);
    console.log(`[tukuk-os] health: http://localhost:${config.port}/health  |  search: http://localhost:${config.port}/search?q=kata`);
    console.log(`[tukuk-os] ask:    http://localhost:${config.port}/ask?q=soalan     |  dev: http://localhost:${config.port}/dev`);
    if (!index) {
      console.log('[tukuk-os] mod fallback sahaja — semak systemctl --user status meilisearch');
    }
    if (!config.brain.enabled) {
      console.log('[tukuk-os] otak dilumpuhkan (BRAIN_ENABLED=false)');
    }
    // Pra-refresh feed RSS supaya tab News pantas pada permintaan pertama.
    setTimeout(() => {
      news.refresh()
        .then((n) => { if (n > 0) console.log(`[news] ${n} item RSS sedia`); })
        .catch(() => {});
    }, 3000);
  });

  const shutdown = (signal) => async () => {
    console.log(`\n[tukuk-os] menerima ${signal}, menutup dengan perlahan...`);
    net.stop();
    store.close();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  };

  process.on('SIGINT', shutdown('SIGINT'));
  process.on('SIGTERM', shutdown('SIGTERM'));
}

main().catch((error) => {
  console.error('[tukuk-os] gagal memulakan:', error.message);
  process.exit(1);
});