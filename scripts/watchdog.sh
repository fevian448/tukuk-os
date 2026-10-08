#!/usr/bin/env bash
# Watchdog Tukuk-OS — pastikan enjin carian sentiasa hidup DAN responsif.
#
# systemd `Restart=always` hanya guna bila proses itu mati. Watchdog ini
# mengendalikan kes lain:
#   1. proses mati              → systemctl --user start
#   2. proses hidup tapi hang   → systemctl --user restart
#   3. Meilisearch mati         → cascade restart
#   4. internet/tunnel bermasalah → log amaran sahaja
#      (laman kekal hidup kerana Cloudflare fallback melayan dari R2)
#
# Jalankan setiap 2 minit melalui systemd timer.

set -uo pipefail

APP="tukuk-os.service"
MEILI="meilisearch.service"
URL="${WATCHDOG_URL:-http://127.0.0.1:8000/health}"
THRESHOLD="${WATCHDOG_THRESHOLD:-2}"
STAMP="/tmp/tukuk-os-watchdog.fail"

log() { logger -t tukuk-os-watchdog -- "$*"; echo "[watchdog] $*"; }

if ! systemctl --user is-active --quiet "$MEILI"; then
  log "Meilisearch tidak aktif — restart"
  systemctl --user restart "$MEILI"
fi

# --- tunnel (servis sistem; kami hanya boleh log, restart perlukan sudo) ---
if ! systemctl is-active --quiet cloudflared.service 2>/dev/null; then
  log "cloudflared (system) tidak aktif — jalankan: sudo systemctl restart cloudflared.service"
fi

# --- laman awam: kesan internet/tunnel putus (bukan sebab restart) ---
# Bila internet awam putus, laman tetap hidup via fallback Cloudflare (R2).
PUB="${WATCHDOG_PUBLIC_URL:-https://tukuk.org/health}"
PUB_STAMP="/tmp/tukuk-os-watchdog.public"
if curl -sf -m 12 -o /dev/null "$PUB"; then
  if [ -f "$PUB_STAMP" ]; then
    log "Internet/tunnel pulih — $PUB menjawab semula"
    rm -f "$PUB_STAMP"
  fi
else
  P=$(cat "$PUB_STAMP" 2>/dev/null || echo 0)
  P=$((P + 1))
  echo "$P" > "$PUB_STAMP"
  # log pada percubaan pertama dan setiap 15 (≈30 minit) — elak spam journal
  if [ "$P" -eq 1 ] || [ $((P % 15)) -eq 0 ]; then
    log "Laman awam tidak menjawab (percubaan $P) — internet/tunnel? Fallback Cloudflare tetap melayan laman statik"
  fi
fi

if ! systemctl --user is-active --quiet "$APP"; then
  log "Enjin carian tidak aktif — start"
  systemctl --user start "$APP"
  rm -f "$STAMP"
  exit 0
fi

if curl -sf -m 10 -o /dev/null "$URL"; then
  if [ -f "$STAMP" ]; then
    log "Sihat semula selepas $(cat "$STAMP") kegagalan berturut-turut"
    rm -f "$STAMP"
  fi
  exit 0
fi

COUNT=$(cat "$STAMP" 2>/dev/null || echo 0)
COUNT=$((COUNT + 1))
echo "$COUNT" > "$STAMP"
log "Health check gagal (percubaan $COUNT/$THRESHOLD): $URL"

if [ "$COUNT" -ge "$THRESHOLD" ]; then
  log "Melebihi ambang — restart $APP"
  systemctl --user restart "$APP"
  rm -f "$STAMP"
fi

exit 0