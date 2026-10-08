---
name: tukuk-chat
description: Chat with Tukuk-OS AI assistant via local server
usage: tukuk-chat <question>
---

# Tukuk-OS Chat

Chat dengan AI assistant Tukuk-OS secara langsung dari terminal.

## Penggunaan

```bash
kilo tukuk-chat "What is Meilisearch?"
kilo tukuk-chat "Apa itu enjin carian?"
kilo tukuk-chat "test ai coding"
```

## Konfigurasi

Pastikan server Tukuk-OS berjalan di `http://localhost:8000`:

```bash
# Start server
cd ~/tukuk-os
node index.js
```

Atau gunakan systemd:

```bash
systemctl --user start tukuk-os
```

## Contoh

```bash
$ kilo tukuk-chat "Tell me about Meilisearch"

Mode: grounded
Answer: Meilisearch is a fast, relevant search engine...

Sources:
1. Meilisearch - Wikipedia
2. Node.js — Run JavaScript Everywhere
```

## Environment Variables

| Variable | Default | Keterangan |
|---|---|---|
| `TUKUK_HOST` | `http://localhost:8000` | URL server Tukuk-OS |
| `TUKUK_API_KEY` | — | API key untuk akses (jika diset) |
