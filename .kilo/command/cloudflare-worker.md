---
name: cloudflare-worker
description: Manage Cloudflare Workers and R2 for Tukuk-OS fallback
---
# Cloudflare Worker

Worker `tukuk-fallback` deployed untuk static fallback bila server tempatan mati.

## Worker Info

- Name: `tukuk-fallback`
- URL: `https://tukuk-fallback.fevianbenjo48.workers.dev`
- Version ID: `a8647778-6704-4dca-bcae-69a19619321e`
- R2 Bucket: `tukuk-fallback`

## Projek Worker

- Lokasi: `/home/tukuk/tukuk-os/cloudflare-worker/tukuk-fallback/`
- Wrangler config: `wrangler.jsonc`
- Source: `src/index.ts`
- Static assets: `public/`

## Arahan

- `npx wrangler deploy` — deploy worker
- `npx wrangler dev` — local development
- `npx wrangler r2 bucket list` — senarai R2 buckets
- `npx wrangler r2 object put <bucket>/<key> --file <path>` — upload object
- `npx wrangler r2 object get <bucket>/<key>` — download object

## Fallback Strategy

Bila server mati:
1. Tunnel ke `localhost:8000` gagal
2. Worker serve static HTML/JS/CSS dari R2
3. API endpoints return 503
