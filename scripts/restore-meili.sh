#!/usr/bin/env bash
# Muat turun backup Meilisearch dari R2 dan pulihkan.
#
# Guna:
#   ./restore-meili.sh --list
#   ./restore-meili.sh meilisearch/2026/10/06/meili_halaman_web-20261006T213432Z.json.gz
#
# Dua laluan muat turun (cukup satu):
#   WORKER : BACKUP_WORKER_URL + BACKUP_UPLOAD_SECRET  (utama)
#   S3     : R2_ACCOUNT_ID + R2_ACCESS_KEY_ID + R2_SECRET_ACCESS_KEY + R2_BUCKET
#
# Dua format:
#   *.json.gz  -> eksport indeks (scripts/export-index.js), dipulihkan via API
#   *.snapshot -> arkib penuh Meilisearch, diekstrak ke data directory

set -euo pipefail

APP_DIR="${APP_DIR:-/home/tukuk/tukuk-os}"
DATA_DIR="${DATA_DIR:-$APP_DIR/meili_data}"
SNAP_DIR="${SNAP_DIR:-$APP_DIR/snapshots}"
MEILI_URL="${MEILI_URL:-http://127.0.0.1:7700}"
R2_ENDPOINT="${R2_ENDPOINT:-https://${R2_ACCOUNT_ID:-}.r2.cloudflarestorage.com}"
R2_REGION="${R2_REGION:-auto}"
R2_BUCKET="${R2_BUCKET:-tukuk-os-backups}"

log() { printf '[restore] %s\n' "$*"; }
fail() { printf '[restore] RALAT: %s\n' "$*" >&2; exit 1; }

# muat kredensial jika dipanggil secara manual
R2_ENV="${R2_ENV:-$HOME/.config/tukuk-os/r2.env}"
if [ -f "$R2_ENV" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$R2_ENV"
  set +a
fi

usable() {
  case "${1:-}" in
    ''|'<'*'>'|*'<your'*) return 1 ;;
    *) return 0 ;;
  esac
}
usable "${R2_ACCESS_KEY_ID:-}" && usable "${R2_SECRET_ACCESS_KEY:-}" && usable "${R2_ACCOUNT_ID:-}" && S3_OK=1 || S3_OK=0
usable "${BACKUP_WORKER_URL:-}" && usable "${BACKUP_UPLOAD_SECRET:-}" && WORKER_OK=1 || WORKER_OK=0

[ "$S3_OK" = 1 ] || [ "$WORKER_OK" = 1 ] || fail "tiada kredensial dalam $R2_ENV"
usable "${MEILI_MASTER_KEY:-}" || fail "MEILI_MASTER_KEY kosong/placeholder"

r2() {
  curl -sf -m 600 --aws-sigv4 "aws:amz:$R2_REGION:s3" \
    --user "$R2_ACCESS_KEY_ID:$R2_SECRET_ACCESS_KEY" "$@"
}
wget_object() {
  curl -sf -m 600 -H "Authorization: Bearer $BACKUP_UPLOAD_SECRET" "$@" 
}

if [ "${1:-}" = "--list" ] || [ -z "${1:-}" ]; then
  if [ "$WORKER_OK" = 1 ]; then
    log "backup dalam $R2_BUCKET (worker):"
    wget_object "$BACKUP_WORKER_URL/?prefix=" | tr '{' '\n' | sed -nE 's/.*"key":"([^"]+)".*"bytes":([0-9]+).*/  \2 bait  \1/p' | sort -r
  else
    log "backup dalam $R2_BUCKET (S3):"
    r2 "$R2_ENDPOINT/$R2_BUCKET" | tr '<' '\n' | sed -nE 's/.*<Key>([^<]+)<\/Key>.*/\1/p' | sort -r
  fi
  exit 0
fi

KEY="$1"
[ -n "$KEY" ] || fail "nyatakan key backup, atau guna --list"

mkdir -p "$SNAP_DIR"
TARGET="$SNAP_DIR/$(basename "$KEY")"

log "memuat turun $KEY -> $TARGET"
if [ "$WORKER_OK" = 1 ]; then
  wget_object "$BACKUP_WORKER_URL/?key=$KEY" -o "$TARGET"
else
  r2 "$R2_ENDPOINT/$R2_BUCKET/$KEY" -o "$TARGET"
fi
[ -s "$TARGET" ] || fail "fail yang dimuat turun kosong"

case "$KEY" in
  store/*.json)
    log "memulihkan store blog -> $APP_DIR/data/tukuk-os.json"
    cp "$TARGET" "$APP_DIR/data/tukuk-os.json"
    if command -v systemctl >/dev/null 2>&1; then
      systemctl --user restart tukuk-os.service 2>/dev/null && log "servis diulang mula" || log "AMARAN: mulakan semula servis secara manual"
    fi
    ;;
  *.json.gz)
    log "pulih indeks dari eksport JSON..."
    MEILI_HOST="$MEILI_URL" node "$APP_DIR/scripts/import-index.js" "$TARGET" \
      || fail "pulihan indeks gagal"
    ;;
  *)
    if command -v systemctl >/dev/null 2>&1; then
      log "menghentikan Meilisearch"
      systemctl --user stop meilisearch 2>/dev/null || pkill -f 'meilisearch --db-path' || true
      sleep 2

      log "memulihkan ke $DATA_DIR"
      rm -rf "$DATA_DIR"
      # Meilisearch snapshot ialah arkib LMDB; ia perlu diekstrak ke dalam direktori data.
      tar -xf "$TARGET" -C "$APP_DIR" || fail "gagal ekstrak snapshot"

      systemctl --user start meilisearch 2>/dev/null || true
      sleep 4
      curl -sf -m 10 "$MEILI_URL/health" >/dev/null \
        && log "Meilisearch sihat selepas restore" \
        || log "AMARAN: semak systemctl --user status meilisearch"
    else
      log "ARKIB dimuat turun ke $TARGET (salin ke $DATA_DIR secara manual)"
    fi
    ;;
esac

log "selesai"
