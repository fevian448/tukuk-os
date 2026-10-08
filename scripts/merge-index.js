#!/usr/bin/env node
/**
 * Merge indeks uji_coba (32k+ dokumen English) ke dalam indeks utama halaman_web.
 * Salinan, bukan pemindahan — uji_coba kekal sebagai asal rujukan.
 * Guna: node scripts/merge-index.js
 */
const { client } = require('../src/meili');

const FROM = 'uji_coba';
const TO = 'halaman_web';
const BATCH = 1000;

async function main() {
  const from = client.index(FROM);
  const to = client.index(TO);

  const fromStats = await from.getStats();
  const toStats = await to.getStats();
  console.log(`[merge] ${FROM}: ${fromStats.numberOfDocuments} dokumen -> ${TO} (${toStats.numberOfDocuments} sedia ada)`);

  let offset = 0;
  let copied = 0;
  for (;;) {
    const res = await from.getDocuments({ offset, limit: BATCH });
    const docs = Array.isArray(res) ? res : (res.results || []);
    if (docs.length === 0) break;
    const task = await to.addDocuments(docs);
    await client.tasks.waitForTask(task.taskUid);
    copied += docs.length;
    process.stdout.write(`[merge] ...${copied}\r`);
    if (docs.length < BATCH) break;
    offset += BATCH;
  }

  const after = await to.getStats();
  console.log(`\n[merge] selesai: ${copied} dokumen disalin; ${TO} kini ${after.numberOfDocuments} dokumen`);
}

main().catch((err) => {
  console.error('[merge] GAGAL:', err.message || err);
  process.exit(1);
});
