---
name: cloudflare-dns
description: Manage Cloudflare DNS records for tukuk.org
---
# Cloudflare DNS

Gunakan `cf` CLI atau Cloudflare MCP untuk mengurus DNS rekod dalam zon `tukuk.org`.

## Konteks

- Zon: `tukuk.org`
- Account ID: `391d9aa59cfcc5ec44c3d25c855c45cb`
- Default context disimpan di `~/.config/cf/config.json`
- CLI: `/usr/bin/cf` (versi 0.0.5)

## Arahan

- `cf dns records list` — senarai semua rekod DNS
- `cf dns records create --body '{"type":"CNAME","name":"sub.tukuk.org","content":"target"}'` — tambah rekod
- `cf dns records edit <id> --body '{"content":"new-target"}'` — edit rekod
- `cf dns records delete <id>` — padam rekod
- `cf zones list` — senarai zon

## Nota

- Semua arahan perlu `--zone tukuk.org` jika tiada context default
- Account ID boleh disembunyikan menggunakan `cf context set account-id`
