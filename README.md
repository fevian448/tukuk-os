# Tukuk-OS

Enjin carian web untuk domain **tukuk.org**. Berasaskan [Meilisearch](https://www.meilisearch.com) dengan crawler sendiri, REST API, GUI web, desktop app (Electron), carian imej/video, dan perlindungan SSRF.

Status: **fungsi** — crawling, pengindeksan, carian tempatan, carian web, imej, video, desktop app, dan hybrid Cloudflare deployment diuji.

---

## Kandungan

- [Ciri](#ciri)
- [Cara Mula](#cara-mula)
- [GUI Web](#gui-web)
- [Desktop App](#desktop-app)
- [Blog](#blog)
- [AI Chat](#ai-chat)
- [PWA](#pwa)
- [Cloudflare Deployment](#cloudflare-deployment)
- [API](#api)
- [Konfigurasi](#konfigurasi)
- [Susun Atur Projek](#susun-atur-projek)
- [Penyelenggaraan](#penyelenggaraan)
- [Keselamatan](#keselamatan)
- [Had](#had)

---

## Ciri

**Carian Tempatan**
- Sorotan `<mark>` + crop `snippet` dengan konteks
- Toleransi silap ejaan (1 ejaan ≥ 4 aksara, 2 ejaan ≥ 8 aksara)
- Sinonim simetri Melayu/Inggeris (`cari` = `carian` = `pencarian` = `geledah`)
- Kata henti Bahasa Melayu
- Facet: `host`, `lang`, `type`, `siteName`, `keywords`
- Penapis: `host`, `lang`, `type`, `siteName`, `section`, `wordCount`, julat tarikh
- Susunan: `newest`, `oldest`, `longest`, `shortest`
- Cadangan `/suggest` untuk autolengkap

**Carian Web, Imej, Video**
- `/websearch` — carian web menggunakan pelbagai penyedia (DuckDuckGo, SearX, Bing)
- `/images` — carian imej dari web
- `/videos` — carian video dari web
- Fallback automatik: `/ask` gunakan carian web bila indeks tempatan tiada hasil
- Cache 5 minit, rate limit 60/minit
- PWA support: boleh "install" ke desktop/home screen tanpa Electron

**Web Browser**
- Browser terbina dalam Tukuk-OS di tab **Browser**
- Proxy `/browse` untuk melayari laman web
- Alamat bar dengan autocomplete
- Sokongan HTML, CSS, JS, imej
- Privacy: tiada tracking, tiada cookies yang dikongsi

**Search Engine Ranking**
- PageRank-like scoring berdasarkan link popularity
- Quality score (0-100) untuk setiap halaman
- Ranking rules: words, typo, proximity, attribute, sort, exactness, quality
- Content quality filter: minimum 100 words, title required
- Domain delay: 1.5s antara request ke domain sama

**AI Chat**
- Chat dengan AI model kecil (Ollama) secara tempatan
- Model: `smollm:135m` (91MB) + `qwen2.5-coder:0.5b` (397MB)
- Chain fallback: Cuba model kecil dahulu, kemudian model lebih besar
- Quality gate: tolak output yang mengulang arahan atau litar ulang
- Fallback ekstraktif: jawapan terus daripada sumber tanpa LLM jika model gagal

**Otak / AI**
- Model bahasa kecil (Ollama) untuk menjawab soalan
- Chain model: smollm:135m → qwen2.5-coder:0.5b
- Quality gate: tolak output yang mengulang arahan atau litar ulang
- Fallback ekstraktif: jawapan terus daripada sumber tanpa LLM jika model gagal
- Soalan tentang Tukuk-OS dilayan terus daripada pengetahuan tetap (tanpa LLM)

**Crawler**
- `robots.txt` dihormati, dengan cache per-origin
- Hash kandungan — indeks semula dilangkau jika halaman tidak berubah
- Sitemap, termasuk sitemap bersarang
- BFS seluruh laman dengan had kedalaman
- Antrean dengan concurrency terkawal (default 4)
- Ekstraksi kaya: tajuk, meta OG/Twitter, headings, imej, canonical, `publishedAt`, bahasa, kata kunci, bilangan perkataan, pautan keluar
- Batch crawl: `node scripts/batch-crawl.js` untuk merayau ramai URL sekaligus

**Operasi**
- Endpoint `/health` dan `/stats` dengan metrik langsung
- Penutupan graceful (`SIGINT` / `SIGTERM`)
- Unit systemd user dengan auto-start

**Desktop**
- Electron desktop app untuk Windows, macOS, Linux
- Auto-start pelayan tempatan apabila dibuka
- Menu aplikasi dengan pintasan papan kekunci
- PWA: boleh install ke desktop/home screen (termasuk iOS) tanpa Electron

---

## Cara Mula

### Prasyarat

- Node.js ≥ 20
- Meilisearch ≥ 1.x
- (Opsional) Electron untuk desktop app

### Langkah 1 — Dapatkan projek

```bash
cd ~/tukuk-os
```

### Langkah 2 — Pasang dependensi

```bash
npm install
```

### Langkah 3 — Sediakan konfigurasi

```bash
cp .env.example .env
nano .env          # tukar MEILI_MASTER_KEY
```

Aplikasi membaca `.env` secara automatik. Fail ini tidak perlu di-commit (sudah ada dalam `.gitignore`).

### Langkah 4 — Pasang Meilisearch

Sekali sahaja:

```bash
curl -L https://install.meilisearch.com | sh
mkdir -p ~/.local/bin
mv meilisearch ~/.local/bin/
chmod +x ~/.local/bin/meilisearch
~/.local/bin/meilisearch --version
```

### Langkah 5 — Mulakan Meilisearch

**Terminal 1:**

```bash
cd ~/tukuk-os
~/.local/bin/meilisearch \
  --db-path ./meili_data \
  --master-key "$(grep MEILI_MASTER_KEY .env | cut -d= -f2)" \
  --http-addr 127.0.0.1:7700
```

Nanti akan appear:

```
Server listening on http://127.0.0.1:7700
```

### Langkah 6 — Mulakan enjin carian

**Terminal 2:**

```bash
cd ~/tukuk-os
npm start
```

Nanti akan appear:

```
[tukuk-os] enjin carian berjalan di http://0.0.0.0:8000
```

Aplikasi menunggu Meilisearch sedia sebelum mula, jadi urutan ini selamat.

### Langkah 7 — Sahkan

```bash
curl -s http://localhost:8000/health
curl -s "http://localhost:8000/search?q=berita&limit=3"
```

Import indeks pertama kali:

```bash
curl -X POST http://localhost:8000/crawl \
  -H "Content-Type: application/json" \
  -d '{"url":"https://tukuk.org"}'
```

---

### Cara Mula Automatik (systemd)

 persistently selepas log out dan reboot:

```bash
mkdir -p ~/.config/systemd/user ~/.config/tukuk-os

cat > ~/.config/tukuk-os/env <<'EOF'
MEILI_MASTER_KEY=masterKeyPelayanAnda
MEILI_HOST=http://127.0.0.1:7700
MEILI_INDEX=halaman_web
PORT=8000
HOST=0.0.0.0
EOF
chmod 600 ~/.config/tukuk-os/env
```

Dua unit files sudah ada dalam repo:

```bash
cp ~/tukuk-os/deploy/meilisearch.service ~/.config/systemd/user/
cp ~/tukuk-os/deploy/tukuk-os.service ~/.config/systemd/user/

systemctl --user daemon-reload
systemctl --user enable --now meilisearch tukuk-os
loginctl enable-linger tukuk     # supaya jalan tanpa login
```

---

## GUI Web

Buka `http://localhost:8000` dalam pelayar.

**Tab Carian:**
- **Web** — carian penuh dengan sorotan, facet, penapis
- **Imej** — grid imej dari carian web
- **Video** — senarai video dari carian web

**Ciri GUI:**
- Autolengkap cadangan carian
- Paginasi "Muat lagi"
- Penapis facet (host, bahasa, jenis)
- Dark/light mode mengikut sistem
- Responsif untuk mobile

---

## Desktop App

Aplikasi desktop Electron untuk Tukuk-OS. Auto-start pelayan tempatan, icon dock/taskbar.

### Prasyarat

```bash
npm install
```

### Build untuk semua platform

```bash
npm run dist
```

Ini akan menghasilkan installer untuk:
- **Windows:** `Tukuk-OS-Setup-2.1.0-x64.exe` (NSIS installer)
- **macOS:** `Tukuk-OS-2.1.0-x64.dmg`, `Tukuk-OS-2.1.0-arm64.dmg`
- **Linux:** `Tukuk-OS-2.1.0-x64.AppImage`, `Tukuk-OS-2.1.0-x64.deb`, `Tukuk-OS-2.1.0-x64.rpm`

Semua fail output di direktori `dist/`.

### Build untuk platform tertentu

```bash
npm run dist:win      # Windows (x64)
npm run dist:mac      # macOS (x64 + arm64)
npm run dist:linux    # Linux (x64 + arm64)
```

### Test build tanpa install

```bash
npm run dist:dir
```

Ini akan buka aplikasi dalam mode development dari folder `dist/` tanpa packaging.

### Pasang di Windows

1. Muat turun `Tukuk-OS-Setup-2.1.0-x64.exe`
2. Klik dua kali untuk install
3. Pilih lokasi instalasi
4. Shortcut automatik dibuat di Desktop dan Start Menu

### Pasang di macOS

1. Muat turun `Tukuk-OS-2.1.0-x64.dmg` (Intel) atau `Tukuk-OS-2.1.0-arm64.dmg` (Apple Silicon)
2. Buka DMG
3. Seret `Tukuk-OS.app` ke dalam folder `Applications`
4. Pertama kali buka: right-click → Open (kerana tidak di-notarize)

### Pasang di Linux

**AppImage (universal):**
```bash
chmod +x Tukuk-OS-2.1.0-x64.AppImage
./Tukuk-OS-2.1.0-x64.AppImage
```

**DEB (Debian/Ubuntu):**
```bash
sudo dpkg -i Tukuk-OS-2.1.0-x64.deb
sudo apt-get install -f  # jika ada dependency
tukuk-os
```

**RPM (Fedora/RHEL):**
```bash
sudo rpm -i Tukuk-OS-2.1.0-x64.rpm
tukuk-os
```

### Mode pembangunan

```bash
npm run desktop
npm run desktop:dev
npm run desktop:no-sandbox
```

### Pintasan

| Pintasan | Fungsi |
|---------|--------|
| `CmdOrCtrl+R` | Muat semula |
| `CmdOrCtrl+Shift+R` | Muat semula tanpa cache |
| `CmdOrCtrl+K` | Fokus kotak carian |
| `CmdOrCtrl+Q` | Keluar |
| `CmdOrCtrl+Shift+I` | Buka DevTools |

### Auto-update

Untuk auto-update, konfigurasi `publish` di `package.json` dengan GitHub Releases:

```json
{
  "publish": {
    "provider": "github",
    "owner": "username",
    "repo": "tukuk-os"
  }
}
```

Kemaskini akan dimuat turun secara automatik apabila versi baharu dilepaskan.

### Troubleshooting Desktop

**Masalah: `setuid_sandbox_host.cc(163)`**

Jika出现 ralat ini, ada dua pilihan:

1. **Tanpa sudo** — guna mod no-sandbox:
   ```bash
   npm run desktop:no-sandbox
   ```

2. **Dengan sudo** — betulkan permission chrome-sandbox:
   ```bash
   sudo chown root:root ~/tukuk-os/node_modules/electron/dist/chrome-sandbox
   sudo chmod 4755 ~/tukuk-os/node_modules/electron/dist/chrome-sandbox
   npm run desktop
   ```

---

## Blog

Tukuk-OS mempunyai blog untuk artikel, tutorial, dan kemaskini projek.

### URL

- `/blog` — senarai semua artikel
- `/blog/:slug` — artikel tertentu

### Admin API

Semua endpoint blog memerlukan `API_KEY`.

| Method | Endpoint | Keterangan |
|---|---|---|
| `GET` | `/admin/blog` | Senarai semua post |
| `POST` | `/admin/blog` | Cipta post baru |
| `PUT` | `/admin/blog/:id` | Kemas kini post |
| `DELETE` | `/admin/blog/:id` | Padam post |

### Format Post

```json
{
  "title": "Tajuk artikel",
  "slug": "tajuk-artikel",
  "content": "<p>Kandungan HTML...</p>",
  "excerpt": "Ringkasan pendek...",
  "author": "Fevian Donald",
  "tags": ["tag1", "tag2"]
}
```

### Contoh

```bash
# Lihat semua post
curl -H "Authorization: Bearer $API_KEY" https://tukuk.org/admin/blog

# Cipta post baru
curl -X POST https://tukuk.org/admin/blog \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Cara Build Search Engine",
    "content": "<p>Kandungan...</p>",
    "tags": ["tutorial", "meilisearch"]
  }'
```

---

## Build Icons

Untuk menjana ikon dari SVG:

```bash
node scripts/generate-icons.js
```

Prasyarat: ImageMagick (`convert`, `iconutil`)
- Debian/Ubuntu: `sudo apt install imagemagick`
- macOS: `brew install imagemagick`
- Windows: `choco install imagemagick`

Output:
- `build/icon.png` — ikon utama
- `build/icon.ico` — Windows (dijana oleh electron-builder)
- `build/icon.icns` — macOS (dijana oleh electron-builder)

---

## PWA (Progressive Web App)

Tukuk-OS adalah PWA yang boleh "install" ke desktop atau home screen tanpa perlu Electron.

### Install di Desktop (Chrome/Edge)

1. Buka `http://localhost:8000`
2. Klik ikon install di address bar (atau menu → "Install Tukuk-OS")
3. Ikut arahan pada skrin

Aplikasi akan muncul di desktop/app drawer seperti app native.

### Install di iOS (iPhone/iPad)

1. Buka `http://localhost:8000` dalam Safari
2. Klik butang Share (kotak dengan anak panah ke atas)
3. Pilih "Add to Home Screen"
4. Namakan "Tukuk-OS" dan klik "Add"

Aplikasi akan muncul di home screen seperti app native. Ia berfungsi sebagai standalone app tanpa Safari UI.

### Fitur PWA

- **Offline support:** Service worker cache halaman utama
- **Install prompt:** Browser akan提示 install bila conditions memenuhi
- **App icon:** Ikonustom di home screen/desktop
- **Standalone mode:** Tanpa browser UI (address bar, tabs)

### Manifest

`public/manifest.json` mengkonfigurasi:
- Nama app, icon, theme color
- Display mode: `standalone`
- Scope: `/`
- Start URL: `/`

### Service Worker

`public/sw.js` meng-cache:
- `/`, `/index.html`
- `/manifest.json`
- Ikon PNG

Cache strategy: **stale-while-revalidate** — app selalu boleh dibuka offline, dan data dikemaskini di background.

### Testing PWA

```bash
# Pastikan HTTPS (PWA memerlukan HTTPS kecuali localhost)
npm start

# Chrome DevTools → Application → Manifest
# Chrome DevTools → Application → Service Workers
```

---

## AI / Chat

Tukuk-OS menggunakan **Ollama** untuk AI chat secara tempatan.

### Model

| Model | Saiz | Keterangan |
|---|---|---|
| `smollm:135m` | 91MB | Chat model ringas, cepat |
| `qwen2.5-coder:0.5b` | 397MB | Coding model, lebih pintar |

### Cara Kerja

1. User tanya soalan via `/ask?q=...`
2. System cari sumber dari Meilisearch
3. LLM model cuba jawab berdasarkan sumber
4. Jika model gagal, fallback ke **extractive answer** (jawapan terus dari sumber)

### Setup

```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull models
ollama pull smollm:135m
ollama pull qwen2.5-coder:0.5b

# Start service
sudo systemctl enable --now ollama
```

### Konfigurasi

Edit `.env`:

```env
BRAIN_ENABLED=true
LLM_CHAIN=smollm:135m,qwen2.5-coder:0.5b
LLM_TIMEOUT=120000
OLLAMA_HOST=http://127.0.0.1:11434
```

### Nota

- Model berjalan di CPU (tiada GPU perlu)
- `smollm:135m` adalah model paling ringas (~91MB)
- Quality gate akan tolak output yang buruk dan guna fallback ekstraktif
- Tiada API key perlu - semua tempatan

---

## Cloudflare Deployment

Tukuk-OS di-deploy melalui **Cloudflare Tunnel** + **Worker fallback** untuk akses global tanpa IP public.

### Live Domains

| Domain | Route | Status |
|---|---|---|
| `tukuk.org` | Tunnel → `localhost:8000` | ✅ Active |
| `www.tukuk.org` | Tunnel → `localhost:8000` | ✅ Active |
| `github.tukuk.org` | CNAME → `github.com` | ✅ Proxied |
| `gitlab.tukuk.org` | CNAME → `gitlab.com` | ✅ Proxied |
| `bitbucket.tukuk.org` | CNAME → `bitbucket.org` | ✅ Proxied |
| `api.tukuk.org` | Tunnel → `localhost:8000` | ✅ Active |
| `dashboard.tukuk.org` | Tunnel → `localhost:8000` | ✅ Active |
| `mqtt.tukuk.org` | Tunnel → `tcp://localhost:1883` | ✅ Active |

### Cloudflare Components

**1. Cloudflare Tunnel (`168a53af-7e70-460f-b697-2190ec0f28ba`)**
- Melayan `tukuk.org`, `www.tukuk.org`, `api.tukuk.org`, `dashboard.tukuk.org`
- Route ke `localhost:8000` (Tukuk-OS server)
- Auto-start pada boot via systemd
- SSL/TLS automatik dari Cloudflare

**2. Worker Fallback (`tukuk-fallback`)**
- URL: `https://tukuk-fallback.fevianbenjo48.workers.dev`
- Melayan static HTML/JS/CSS bila server mati
- R2 bucket: `tukuk-fallback` untuk assets
- API endpoints return 503 bila offline

**3. DNS Records**
- Subdomain GitHub/GitLab/Bitbucket menggunakan CNAME + Cloudflare proxy
- Root domain `tukuk.org` menggunakan tunnel CNAME
- Semua trafik melalui Cloudflare network (DDoS protection, CDN)

**4. Kilo Config**
- Cloudflare MCP enabled di `kilo.json`
- Agent `cloudflare` dengan full access
- Commands: `cloudflare-dns`, `cloudflare-tunnel`, `cloudflare-worker`

### Hybrid Failover System

Sistem automatik untuk switch antara tunnel dan Worker fallback:

**Failover Monitor (`/tmp/failover-monitor.sh`)**
- Check `localhost:8000` setiap 30 saat
- Jika gagal 3x berturut-turut → switch ke Worker fallback
- Jika server pulih → restore ke tunnel
- Berjalan sebagai systemd service

**Install Failover Monitor:**
```bash
sudo /tmp/install-failover.sh
```

**Test Failover:**
```bash
# Simulate server down
sudo systemctl stop tukuk-os
# Tunggu 90 saat, monitor akan switch ke Worker

# Restore
sudo systemctl start tukuk-os
# Tunggu 30 saat, monitor akan restore tunnel
```

### Manual Failover

Jika perlu switch manual ke Worker fallback:

1. Buka **https://dash.cloudflare.com**
2. Pergi ke **Workers & Pages > Routes**
3. Tambah route: `tukuk.org/*` → Worker `tukuk-fallback`
4. Tunggu 1-5 minit

### AdSense Integration

Tukuk-OS menggunakan Google AdSense untuk monetization:
- Publisher ID: `ca-pub-8954948214333500`
- Script loaded di `public/index.html`
- Meta tag: `<meta name="google-adsense-account" content="ca-pub-8954948214333501">`

---

### `GET /search`

```bash
curl "http://localhost:8000/search?q=indeks+terbalik&limit=5"
```

| Parameter | Jenis | Default | Keterangan |
|---|---|---|---|
| `q` | string | — | Kata kunci carian (wajib) |
| `limit` | number | 20 | 1–100 |
| `offset` | number | 0 | Paginasi |
| `host` | string | — | Tapis host (pisah koma) |
| `lang` | string | — | `ms`, `en`, `en-GB`, … |
| `type` | string | — | `article`, `website`, … |
| `site` | string | — | Nama laman |
| `section` | string | — | Bahagian artikel |
| `minWords` | number | — | Bilangan perkataan minimum |
| `excludeHost` | string | — | Halang host (pisah koma) |
| `after` / `before` | ISO date | — | Julat masa crawl |
| `sort` | string | relevans | `newest`, `oldest`, `longest`, `shortest` |
| `facets` | bool | true | `false` untuk matikan facet |
| `full` | bool | false | `true` untuk sertakan kandungan penuh |
| `smart` | bool | true | `false` untuk padanan_strategy `last` |

Contoh balasan:

```json
{
  "query": "indeks terbalik",
  "hits": [
    {
      "id": "u_02ed71ac36bd199e6d178227",
      "url": "https://en.wikipedia.org/wiki/Search_engine",
      "title": "Search engine - Wikipedia",
      "siteName": "en.wikipedia.org",
      "host": "en.wikipedia.org",
      "lang": "en",
      "wordCount": 960,
      "snippet": "…berdasarkan sistem <mark>indeks</mark> terbalik…",
      "highlights": { "title": "<mark>Search engine</mark> - Wikipedia" },
      "matchedTerms": ["content"]
    }
  ],
  "total": 1,
  "facets": { "host": { "en.wikipedia.org": 1 }, "lang": { "en": 1 } },
  "tookMs": 9
}
```

### `GET /suggest`

```bash
curl "http://localhost:8000/suggest?q=node"
```

### `GET /websearch`

```bash
curl "http://localhost:8000/websearch?q=meilisearch"
```

| Parameter | Jenis | Default | Keterangan |
|---|---|---|---|
| `q` | string | — | Kata kunci carian web (wajib) |

Balasan:

```json
{
  "query": "meilisearch",
  "hits": [
    {
      "title": "Meilisearch: Unified Search & AI Retrieval Platform",
      "url": "https://www.meilisearch.com",
      "description": "Meilisearch is an open-source search engine...",
      "snippet": "Meilisearch is an open-source search engine..."
    }
  ],
  "total": 10,
  "tookMs": 1200,
  "provider": "bing"
}
```

**Nota:** `/websearch` menggunakan pelbagai penyedia: DuckDuckGo, SearX (public instances), dan Bing. Ia mencuba setiap penyedia secara berurutan sehingga satu berjaya. Di-rate-limit (60 permintaan/minit) dan di-cache selama 5 minit. Sekarang dalam environment maya, DuckDuckGo kadang-kadang menyekat carian automatik — sistem akan automatik jatuh ke penyedia lain (SearX/Bing).

### `GET /images`

```bash
curl "http://localhost:8000/images?q=kucing"
```

| Parameter | Jenis | Default | Keterangan |
|---|---|---|---|
| `q` | string | — | Kata kunci carian imej (wajib) |

Balasan:

```json
{
  "query": "kucing",
  "hits": [
    {
      "type": "image",
      "title": "kucing — imej 1",
      "url": "https://example.com/kucing.jpg",
      "thumbnail": "https://example.com/kucing.jpg",
      "description": "Imej untuk 'kucing' dari carian web."
    }
  ],
  "total": 0,
  "tookMs": 500
}
```

**Nota:** Carian imej menggunakan fallback dari carian web + pengekstrakan URL imej. Semua URL dilaporkan sebagai media sebener.

### `GET /videos`

```bash
curl "http://localhost:8000/videos?q=node.js+tutorial"
```

| Parameter | Jenis | Default | Keterangan |
|---|---|---|---|
| `q` | string | — | Kata kunci carian video (wajib) |

Balasan:

```json
{
  "query": "node.js tutorial",
  "hits": [
    {
      "type": "video",
      "title": "node.js tutorial — video 1",
      "url": "https://www.youtube.com/watch?v=...",
      "thumbnail": "",
      "description": "Video untuk 'node.js tutorial' dari carian web."
    }
  ],
  "total": 1,
  "tookMs": 400
}
```

**Nota:** Carian video menggunakan fallback dari carian web + pengekstrakan URL platform video (YouTube, Vimeo, dll.).

### `POST /crawl` — satu URL

```bash
curl -X POST http://localhost:8000/crawl \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}'
```

### `POST /crawl/batch` — senarai URL

```bash
curl -X POST http://localhost:8000/crawl/batch \
  -H "Content-Type: application/json" \
  -d '{"urls":["https://a.com","https://b.com"],"concurrency":4}'
```

### `POST /crawl/sitemap`

```bash
curl -X POST http://localhost:8000/crawl/sitemap \
  -H "Content-Type: application/json" \
  -d '{"url":"https://blog.rust-lang.org/sitemap.xml","maxPages":50}'
```

### `POST /crawl/site` — BFS

```bash
curl -X POST http://localhost:8000/crawl/site \
  -H "Content-Type: application/json" \
  -d '{"url":"https://nodejs.org/en","maxPages":10}'
```

### `POST /documents` — indekskan terus

```bash
curl -X POST http://localhost:8000/documents \
  -H "Content-Type: application/json" \
  -d '{"documents":[{"id":"d1","url":"https://x.my/1","title":"Tajuk","content":"Kandungan"}]}'
```

### `DELETE /documents/:id`

```bash
curl -X DELETE http://localhost:8000/documents/d1
```

### `GET /ask` — tanya soalan

```bash
curl "http://localhost:8000/ask?q=apa+itu+meilisearch"
```

| Parameter | Jenis | Default | Keterangan |
|---|---|---|---|
| `q` | string | — | Soalan (wajib) |
| `limit` | number | 4 | Had pengambilan sumber |

Balasan:

```json
{
  "question": "apa itu meilisearch",
  "answer": "Meilisearch ialah enjin carian...",
  "mode": "grounded",
  "method": "extractive",
  "model": "ekstraktif (tanpa LLM)",
  "tookMs": 45230,
  "sources": [...],
  "rejectedModels": [],
  "warning": null
}
```

**Mode:**
- `self` — soalan tentang Tukuk-OS (pengetahuan tetap)
- `grounded` — jawapan berdasarkan sumber dalam indeks
- `web` — jawapan berdasarkan carian web
- `ungrounded` — tiada sumber, jawapan fallback

### `GET /health` · `GET /stats` · `POST /settings`

```bash
curl http://localhost:8000/health
curl http://localhost:8000/stats
curl -X POST http://localhost:8000/settings \
  -H "Content-Type: application/json" \
  -d '{"pagination":{"maxTotalHits":5000}}'
```

---

## Konfigurasi

Semua melalui environment variables atau fail `.env`:

| Variable | Default | Keterangan |
|---|---|---|
| `HOST` | `0.0.0.0` | Antaramuka ikatan |
| `PORT` | `8000` | Port aplikasi |
| `MEILI_HOST` | `http://127.0.0.1:7700` | Alamat Meilisearch |
| `MEILI_MASTER_KEY` | — | **Wajib** |
| `MEILI_INDEX` | `halaman_web` | Nama index |
| `MEILI_DB_PATH` | `./meili_data` | Lokasi data Meilisearch |
| `CRAWLER_UA` | `TukukOS-Bot/1.0 …` | User-Agent crawler |
| `CRAWL_CONCURRENCY` | `2` | Rayuan serentak |
| `CRAWL_TIMEOUT` | `25000` | Timeout HTTP (ms) |
| `CRAWL_MAX_BYTES` | `5242880` | Saiz respons maksimum |
| `CRAWL_MAX_DEPTH` | `5` | Had kedalaman BFS |
| `CRAWL_MAX_PAGES` | `1000` | Had halaman per seed |
| `CRAWL_QUEUE_LIMIT` | `10000` | Had antrean |
| `CRAWL_RESPECT_ROBOTS` | `true` | Hormati robots.txt |
| `CRAWL_ALLOW_PRIVATE` | `false` | Benarkan alamat dalaman |
| `CRAWL_DELAY_MS` | `1500` | Jeda antara request ke domain sama |
| `CRAWL_MIN_WORDS` | `100` | Minimum perkataan untuk index |
| `CRAWL_ALLOW_PRIVATE` | `false` | Benarkan alamat dalaman (development) |
| `CONTENT_CHARS` | `6000` | Had panjang kandungan |
| `SEARCH_TIMEOUT_MS` | `1000` | `searchCutoffMs` Meilisearch |
| `BRAIN_ENABLED` | `true` | Dayakan / lumpuhkan otak AI |
| `LLM_CHAIN` | `smollm:135m,qwen2.5-coder:0.5b` | Senarai model Ollama |
| `LLM_TIMEOUT` | `120000` | Timeout permintaan LLM (ms) |
| `BRAIN_RETRIEVAL_LIMIT` | `4` | Had pengambilan sumber |
| `WEBSEARCH_ENABLED` | `true` | Dayakan / lumpuhkan carian web |
| `WEBSEARCH_PROVIDER` | `duckduckgo` | Penyedia carian web |
| `WEBSEARCH_TIMEOUT` | `15000` | Timeout permintaan carian web (ms) |
| `WEBSEARCH_MAX_RESULTS` | `10` | Had hasil carian web |
| `WEBSEARCH_CACHE_SECONDS` | `300` | Tempoh cache hasil carian web (saat) |
| `WEBSEARCH_UA` | `TukukOS-WebSearch/1.0` | User-Agent untuk carian web |
| `API_KEY` | — | Kunci untuk laluan mutasi |
| `CLOUDFLARE_TUNNEL_ID` | `168a53af-7e70-460f-b697-2190ec0f28ba` | Cloudflare Tunnel ID |
| `CLOUDFLARE_ZONE` | `tukuk.org` | Cloudflare Zone |
| `CLOUDFLARE_WORKER` | `tukuk-fallback` | Nama Worker fallback |
| `CLOUDFLARE_R2_BUCKET` | `tukuk-fallback` | R2 bucket untuk static backup |

---

## Batch Crawl

Script untuk merayau ramai URL sekaligus daripada senarai biji:

```bash
node scripts/batch-crawl.js
node scripts/batch-crawl.js --seeds seeds/custom.txt --max 2000 --concurrency 8
```

- Baca senarai biji dari `seeds/default.txt` (64 laman)
- Hormati `robots.txt`
- Cari sitemap secara automatik
- Gunakan `/crawl/batch` endpoint
- Elakkan ulangan dengan deduplikasi

---

## Susun Atur Projek

```
tukuk-os/
├── desktop/
│   ├── main.js             Electron main process
│   └── preload.js          Context bridge
├── scripts/
│   ├── batch-crawl.js       Batch crawl dari senarai biji
│   ├── backup-meili.sh      Backup ke R2
│   ├── restore-meili.sh     Pulihkan dari R2
│   ├── watchdog.sh          Pemantau servis
│   └── generate-icons.js    Jana ikon desktop dari SVG
├── seeds/
│   └── default.txt          64 biji laman untuk di-crawl
├── src/
│   ├── config.js            Baca .env + tetapan
│   ├── index.js             Bootstrap aplikasi
│   ├── meili.js             Client + tetapan carian
│   ├── extract.js           HTML -> dokumen terstruktur
│   ├── crawler.js           Antrean, robots.txt, sitemap, BFS
│   ├── middleware.js        Rate limiting + API key
│   ├── server.js            Laluan HTTP
│   ├── util.js              SSRF guard, URL, hash, teks
│   ├── brain/
│   │   ├── provider.js      Ollama provider
│   │   ├── rag.js           Retrieval-Augmented Generation
│   │   ├── websearch.js     DuckDuckGo web search
│   │   ├── media-search.js  Imej/video search
│   │   ├── quality.js       Quality gate + fallback ekstraktif
│   │   └── knowledge.js     Pengetahuan tetap Tukuk-OS
├── build/
│   ├── icon.svg             Sumber ikon
│   ├── icon.png             Ikon utama (512x512)
│   ├── icon.ico             Ikon Windows
│   └── icon.icns            Ikon macOS
├── public/
│   ├── index.html           GUI utama (web/imej/video)
│   ├── about.html           Halaman tentang
│   ├── privacy.html         Dasar privasi
│   ├── terms.html           Terma penggunaan
│   └── contact.html         Hubungi kami
├── cloudflare-worker/
│   └── tukuk-fallback/        Worker + R2 fallback bila server mati
├── ai-models/                 Model AI untuk chat (Ollama)
│   ├── README.md              Dokumentasi model
│   └── setup-ollama.sh        Script setup Ollama
├── deploy/                  Unit systemd
├── meili_data/              Data Meilisearch
├── dist/                    Output build Electron
├── .env.example             Contoh konfigurasi
├── .gitignore               Aturan git
├── package.json             Dependencies + build config
├── kilo.json                Kilo config + Cloudflare MCP
├── .kilo/                   Kilo commands + agents
└── README.md
```

---

## Distribusi Desktop

### Build untuk semua platform

```bash
npm run dist
```

Output di direktori `dist/`:
- **Windows:** `Tukuk-OS-Setup-2.1.0-x64.exe` (NSIS installer)
- **macOS:** `Tukuk-OS-2.1.0-x64.dmg`, `Tukuk-OS-2.1.0-arm64.dmg`
- **Linux:** `Tukuk-OS-2.1.0-x64.AppImage`, `Tukuk-OS-2.1.0-x64.deb`, `Tukuk-OS-2.1.0-x64.rpm`

### Platform-specific builds

```bash
npm run dist:win      # Windows x64
npm run dist:mac      # macOS x64 + arm64
npm run dist:linux    # Linux x64 + arm64
npm run dist:dir      # Development mode (tanpa packaging)
```

### Pasang di Windows

1. Muat turun `Tukuk-OS-Setup-2.1.0-x64.exe`
2. Klik dua kali untuk install
3. Pilih lokasi instalasi
4. Shortcut automatik dibuat di Desktop dan Start Menu

### Pasang di macOS

1. Muat turun `Tukuk-OS-2.1.0-x64.dmg` (Intel) atau `Tukuk-OS-2.1.0-arm64.dmg` (Apple Silicon)
2. Buka DMG
3. Seret `Tukuk-OS.app` ke dalam folder `Applications`
4. Pertama kali buka: right-click → Open (kerana belum di-notarize)

### Pasang di Linux

**AppImage:**
```bash
chmod +x Tukuk-OS-2.1.0-x64.AppImage
./Tukuk-OS-2.1.0-x64.AppImage
```

**DEB (Debian/Ubuntu):**
```bash
sudo dpkg -i Tukuk-OS-2.1.0-x64.deb
sudo apt-get install -f
tukuk-os
```

**RPM (Fedora/RHEL):**
```bash
sudo rpm -i Tukuk-OS-2.1.0-x64.rpm
tukuk-os
```

### Auto-update via GitHub Releases

Konfigurasi `publish` di `package.json` dengan GitHub Releases:

```json
{
  "publish": {
    "provider": "github",
    "owner": "username",
    "repo": "tukuk-os"
  }
}
```

Kemaskini akan dimuat turun secara automatik apabila versi baharu dilepaskan.

### Jana ikon

```bash
node scripts/generate-icons.js
```

Prasyarat: ImageMagick
- Debian/Ubuntu: `sudo apt install imagemagick`
- macOS: `brew install imagemagick`
- Windows: `choco install imagemagick`

---

---

## Penyelenggaraan

### systemd

```bash
systemctl --user status tukuk-os meilisearch
systemctl --user restart tukuk-os
systemctl --user stop tukuk-os
journalctl --user -u tukuk-os -f          # log langsung
journalctl --user -u tukuk-os --since today
```

### Backup

Backup automatik ke Cloudflare R2 setiap 6 jam (`00:15`, `06:15`, `12:15`, `18:15`):

```bash
cat > ~/.config/tukuk-os/r2.env <<'EOF'
R2_ACCOUNT_ID=<dari R2>
R2_ACCESS_KEY_ID=<dari R2>
R2_SECRET_ACCESS_KEY=<dari R2>
R2_BUCKET=tukuk-os-backups
EOF
chmod 600 ~/.config/tukuk-os/r2.env

systemctl --user daemon-reload
systemctl --user enable --now meili-backup.timer
systemctl --user list-timers meili-backup.timer
```

Jalankan manual:

```bash
set -a; . ~/.config/tukuk-os/r2.env; set +a
./scripts/backup-meili.sh
```

Pulihkan:

```bash
./scripts/restore-meili.sh --list                       # senarai snapshot
./scripts/restore-meili.sh meilisearch/2026/10/05/...   # muat turun + restore
```

Snapshot disimpan sebagai `meilisearch/YYYY/MM/DD/meili_data-<timestamp>.snapshot`.

Backup manual tanpa R2:

```bash
curl -X POST http://127.0.0.1:7700/snapshots -H "Authorization: Bearer $MEILI_MASTER_KEY"
cp -r ~/tukuk-os/meili_data ~/backup/meili_data-$(date +%F)
```

---

## Keselamatan

- **Rate limiting** terbina dalam — `120` carian/min, `10` tulis/min, `5` crawl/min setiap IP. Header `X-RateLimit-*` dan `Retry-After` dikembalikan.
- **API key** untuk semua laluan mutasi (`POST /crawl*`, `POST /documents`, `DELETE`, `POST /settings`). Set `API_KEY=` untuk aktifkan.
- **Perlindungan SSRF** — alamat dalaman disekat: `127.0.0.0/8`, `10/8`, `172.16/12`, `192.168/16`, `169.254/16`, `100.64/10`, IPv6 ULA dan link-local. Nama hos dalaman (`localhost`, `*.local`, `*.internal`) turut disekat.
- **robots.txt** dihormati secara default
- **Had saiz respons** 3 MB, had redirect 3
- **Cache-Control** pada `/search`, `/websearch`, `/images`, `/videos` untuk edge caching

```bash
curl -X POST http://localhost:8000/crawl \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}'
```

> **Sebelum deploy ke awam:** pastikan `API_KEY` ditetapkan dalam `~/.config/tukuk-os/env`. Tanpa itu, sesiapa boleh memaksa crawler merayau URL dan menimpa ranking rules. `/stats` turut mendedahkan metrik dalaman.

---

## Had

- Tiada rendering JavaScript — hanya HTML statik
- Tiada VPN/proxy rotation, jadi sesuai untuk skala kecil hingga sederhana
- `content` dipotong 6000 aksara; dokumen sangat panjang kehilangan ekor
- Maks 500 URL setiap sitemap, 200 halaman setiap seed
- Tiada crawl terjadual — panggil manual, atau jadualkan dengan `cron`
- DuckDuckGo HTML scraping mungkin disekat oleh CAPTCHA — carian tempatan tetap berfungsi

---

## Lesen

ISC
