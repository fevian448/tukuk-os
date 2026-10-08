---
name: cloudflare-tunnel
description: Manage Cloudflare Tunnel for tukuk.org
---
# Cloudflare Tunnel

Tunnel `b400ad84-e3c8-4bf6-967e-7be110e988c2` sedang berjalan sebagai systemd service.

## Konfigurasi

- Config: `/etc/cloudflared/config.yml`
- Credentials: `/etc/cloudflared/b400ad84-e3c8-4bf6-967e-7be110e988c2.json`
- Service: `cloudflared.service` (enabled, active)

## Ingress Routes

- `tukuk.org` → `http://localhost:8000`
- `www.tukuk.org` → `http://localhost:8000`
- `dashboard.tukuk.org` → `http://localhost:8000`
- `api.tukuk.org` → `http://localhost:8000`
- `mqtt.tukuk.org` → `tcp://localhost:1883`

## Arahan

- `sudo systemctl restart cloudflared` — restart tunnel
- `sudo systemctl status cloudflared` — semak status
- `journalctl -u cloudflared -f` — log实时
- `cloudflared tunnel run b400ad84-e3c8-4bf6-967e-7be110e988c2` — run manual

## Nota

- Port 8000 adalah Tukuk-OS server utama
- Port 1883 adalah MQTT broker
- Auto-start pada boot: enabled
