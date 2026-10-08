const store = require('./store');
const journeyA = require('./articles/journey-a');
const journeyB = require('./articles/journey-b');
const tukukA = require('./articles/tukuk-a');
const tukukB = require('./articles/tukuk-b');
const extra = require('./articles/extra');

const AUTHOR = 'Fevian Donald';
const articles = [...journeyA, ...journeyB, ...tukukA, ...tukukB, ...extra];

function wordCount(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length;
}

function seed() {
  store.load();

  let authorsFixed = 0;
  for (const post of store.getAllPosts(500)) {
    if (post.author !== AUTHOR) {
      store.updatePost(post.id, { author: AUTHOR });
      authorsFixed += 1;
    }
  }

  let added = 0;
  const problems = [];
  for (const item of articles) {
    if (store.getPostBySlug(item.slug)) continue;
    store.createPost({ ...item, author: AUTHOR });
    added += 1;
    const wc = wordCount(item.content);
    if (wc < 650 || wc > 850) problems.push(`${wc} patah perkataan: ${item.title}`);
  }

  const total = store.getAllPosts(500).length;
  console.log(`[seed-v2] Pengarang diseragamkan: ${authorsFixed}`);
  console.log(`[seed-v2] Artikel baharu ditambah: ${added}`);
  console.log(`[seed-v2] Jumlah artikel: ${total}`);
  if (problems.length) {
    console.log('[seed-v2] AMARAN di luar julat 650-850 patah perkataan:');
    for (const p of problems) console.log('  - ' + p);
  } else {
    console.log('[seed-v2] Semua artikel baharu dalam julat 650-850 patah perkataan.');
  }
}

seed();
process.exit(0);
