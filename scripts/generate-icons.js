#!/usr/bin/env node
/**
 * generate-icons.js — Jana ikon untuk desktop app.
 *
 * Prasyarat: sharp (sudah diinstall sebagai devDependency)
 *
 * Guna:
 *   node scripts/generate-icons.js
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const BUILD_DIR = path.join(__dirname, '..', 'build');
const SVG = path.join(BUILD_DIR, 'icon.svg');

function generate() {
  if (!fs.existsSync(SVG)) {
    console.error('Fail ikon tidak dijumpai:', SVG);
    process.exit(1);
  }

  const sizes = [
    { name: 'icon.png', size: 512 },
    { name: 'icon-256.png', size: 256 },
    { name: 'icon-128.png', size: 128 },
    { name: 'icon-64.png', size: 64 },
    { name: 'icon-48.png', size: 48 },
    { name: 'icon-32.png', size: 32 },
    { name: 'icon-16.png', size: 16 }
  ];

  console.log('[icons] menjana ikon PNG...');
  for (const { name, size } of sizes) {
    const out = path.join(BUILD_DIR, name);
    sharp(SVG)
      .resize(size, size)
      .png()
      .toFile(out)
      .then(() => console.log(`[icons] ${out}`))
      .catch((err) => {
        console.error(`[icons] gagal jana ${out}:`, err.message);
      });
  }

  // ICO untuk Windows (electron-builder akan jana dari PNG)
  console.log('[icons] langkau icon.ico (electron-builder akan jana automatik)');

  // ICNS untuk macOS (electron-builder akan jana dari PNG)
  if (process.platform === 'darwin') {
    console.log('[icons] langkau icon.icns (electron-builder akan jana automatik)');
  } else {
    console.log('[icons] langkau icon.icns (hanya untuk macOS)');
  }

  console.log('[icons] selesai!');
}

generate();
