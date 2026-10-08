#!/usr/bin/env node
/**
 * Import blog posts from Markdown files into the Tukuk-OS store.
 *
 *   node scripts/import-posts.js [dir]
 *
 * File format:
 *   SLUG: my-slug
 *   TITLE: My title
 *   EXCERPT: One sentence summary.
 *   TAGS: tag one, tag two
 *
 *   ## Section heading
 *   Body text...
 *
 * Existing posts are updated by slug, new ones are created.
 */

const fs = require('fs');
const path = require('path');
const store = require('../src/store');

const dir = process.argv[2] || path.join(__dirname, '..', 'content', 'blog');

if (!fs.existsSync(dir)) {
  console.error(`Folder tidak dijumpai: ${dir}`);
  process.exit(1);
}

const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort();
if (!files.length) {
  console.error(`Tiada fail .md dalam ${dir}`);
  process.exit(1);
}

let created = 0;
let updated = 0;
let skipped = 0;

for (const file of files) {
  const raw = fs.readFileSync(path.join(dir, file), 'utf8');
  const lines = raw.split(/\r?\n/);
  const header = {};
  let i = 0;
  for (; i < lines.length; i += 1) {
    const match = lines[i].match(/^(SLUG|TITLE|EXCERPT|TAGS):\s*(.*)$/);
    if (!match) break;
    header[match[1]] = match[2].trim();
  }

  const body = lines.slice(i).join('\n').replace(/^\s*\n/, '').trimEnd();
  const slug = header.SLUG || file.replace(/\.md$/, '');
  const words = body.split(/\s+/).filter(Boolean).length;

  if (words < 80) {
    console.log(`skip  ${String(words).padStart(4)}w  ${slug} (terlalu pendek)`);
    skipped += 1;
    continue;
  }

  const title = header.TITLE || slug;
  const excerpt = header.EXCERPT || body.slice(0, 200);
  const tags = (header.TAGS || '').split(',').map((t) => t.trim()).filter(Boolean);

  const existing = store.getPostBySlug(slug);
  if (existing) {
    store.updatePost(existing.id, { title, excerpt, tags, content: body });
    updated += 1;
  } else {
    store.createPost({ slug, title, excerpt, tags, content: body });
    created += 1;
  }
  console.log(`${existing ? 'update' : 'create'} ${String(words).padStart(4)}w  ${slug}`);
}

store.flush();
const total = store.getAllPosts(500).length;
console.log(`\ncreated=${created} updated=${updated} skipped=${skipped} total=${total}`);
