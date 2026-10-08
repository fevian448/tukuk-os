#!/usr/bin/env bash
# Backup Meilisearch ke Cloudflare R2.
#
# Dua laluan — cukup satu sahaja:
#
#   1) WORKER (disyorkan, tiada kunci S3):
#        eksport indeks -> gzip -> POST ke worker tukuk-backup -> R2
#        PERLU: BACKUP_WORKER_URL + BACKUP_UPLOAD_SECRET
#
#   2) S3 LEGACY (kunci R2 tulen):
#        snapshot penuh Meilisearch -> curl --aws-sigv4
#        PERLU: R2_ACCOUNT_ID + R2_ACCESS_KEY_ID + R2_SECRET_ACCESS_KEY + R2_BUCKET
#
#   BERSAMA: MEILI_MASTER_KEY
#
# Semua nilai dalam ~/.config/tukuk-os/r2.env (EnvironmentFile systemd).

set -euo pipefail

# Muat nilai dari r2.env (gaya EnvironmentFile) jika belum ada dalam persekitaran.
if [ -f "${HOME}/.config/tukuk-os/r2.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "${HOME}/.config/tukuk-os/r2.env"
  set +a
fi

APP_DIR="${APP_DIR:-/home/tukuk/tukuk-os}"
SNAP_DIR="${SNAP_DIR:-$APP_DIR/snapshots}"
MEILI_URL="${MEILI_URL:-http://127.0.0.1:7700}"
MEILI_INDEX="${MEILI_INDEX:-halaman_web}"
R2_ENDPOINT="${R2_ENDPOINT:-https://${R2_ACCOUNT_ID:-}.r2.cloudflarestorage.com}"
R2_REGION="${R2_REGION:-auto}"
R2_BUCKET="${R2_BUCKET:-tukuk-os-backups}"
KEEP_LOCAL="${KEEP_LOCAL:-3}"
TIMEOUT="${TIMEOUT:-300}"

log() { printf '[backup] %s\n' "$*"; }
fail() { printf '[backup] RALAT: %s\n' "$*" >&2; exit 1; }

# anggap placeholder <...> sebagai belum diisi
usable() {
  case "${1:-}" in
    ''|'<'*'>'|*'<your'*) return 1 ;;
    *) return 0 ;;
  esac
}

usable "${R2_ACCESS_KEY_ID:-}" && usable "${R2_SECRET_ACCESS_KEY:-}" && usable "${R2_ACCOUNT_ID:-}" && S3_OK=1 || S3_OK=0
usable "${BACKUP_WORKER_URL:-}" && usable "${BACKUP_UPLOAD_SECRET:-}" && WORKER_OK=1 || WORKER_OK=0

usable "${MEILI_MASTER_KEY:-}" || fail "MEILI_MASTER_KEY kosong/placeholder (semak ~/.config/tukuk-os/r2.env)"
[ "$S3_OK" = 1 ] || [ "$WORKER_OK" = 1 ] || fail "tiada laluan: isi BACKUP_WORKER_URL+BACKUP_UPLOAD_SECRET (utama) ATAU R2_* kunci S3"

mkdir -p "$SNAP_DIR"

upload_worker() {
  local file="$1" key="$2" ctype="${3:-application/gzip}"
  local size remote
  size=$(stat -c%s "$file")
  log "memuat naik $(basename "$file") ($size bait) -> $R2_BUCKET/$key"

  curl -sf -m 900 -X POST \
    -H "Authorization: Bearer $BACKUP_UPLOAD_SECRET" \
    -H "Content-Type: $ctype" \
    --data-binary "@$file" \
    "$BACKUP_WORKER_URL/?key=$key" \
    || fail "muat naik worker gagal"

  remote=$(curl -sf -m 60 -H "Authorization: Bearer $BACKUP_UPLOAD_SECRET" \
    "$BACKUP_WORKER_URL/?key=$key" -o /dev/null -w '%{size_download}')
  [ "$remote" = "$size" ] || fail "saiz tidak sepadan: local=$size remote=$remote"
  log "sahkan saiz OK ($size bait)"
}

prune_local() {
  local pattern="$1"
  local -a files
  mapfile -t files < <(ls -1t "$SNAP_DIR"/$pattern 2>/dev/null || true)
  local f
  for f in "${files[@]:$KEEP_LOCAL}"; do
    [ -n "$f" ] && rm -f "$f" && log "buang backup local: $(basename "$f")"
  done
  return 0
}

if [ "$WORKER_OK" = 1 ]; then
  # ---- laluan 1: eksport indeks -> worker ----
  STAMP=$(date -u +%Y%m%dT%H%M%SZ)
  OUT="$SNAP_DIR/meili_${MEILI_INDEX}-${STAMP}.json.gz"
  log "meng eksport indeks $MEILI_INDEX..."
  MEILI_HOST="$MEILI_URL" node "$APP_DIR/scripts/export-index.js" "$OUT" "$MEILI_INDEX" \
    || { rm -f "$OUT"; fail "eksport indeks gagal"; }
  upload_worker "$OUT" "meilisearch/$(date -u +%Y/%m/%d)/$(basename "$OUT")"
  prune_local 'meili_*.json.gz'

  # store blog (data/tukuk-os.json) — bukan sebahagian daripada eksport Meilisearch
  STORE="$APP_DIR/data/tukuk-os.json"
  if [ -f "$STORE" ]; then
    SOUT="$SNAP_DIR/store_${STAMP}.json"
    cp "$STORE" "$SOUT"
    upload_worker "$SOUT" "store/$(date -u +%Y/%m/%d)/$(basename "$SOUT")" "application/json"
    prune_local 'store_*.json'
  fi
  prune_local 'meili_*.json.gz'
elif [ "$S3_OK" = 1 ]; then
  # ---- laluan 2: snapshot penuh -> S3 ----
  log "mencipta snapshot Meilisearch..."
  TASK=$(curl -sf -m 30 -X POST "$MEILI_URL/snapshots" \
    -H "Authorization: Bearer $MEILI_MASTER_KEY" | sed -E 's/.*"taskUid":([0-9]+).*/\1/')
  [ -n "$TASK" ] || fail "gagal mendapatkan taskUid daripada Meilisearch"
  log "task uid: $TASK"

  STARTED=$SECONDS
  while :; do
    BODY=$(curl -sf -m 15 "$MEILI_URL/tasks/$TASK" -H "Authorization: Bearer $MEILI_MASTER_KEY")
    STATUS=$(printf '%s' "$BODY" | sed -E 's/.*"status":"([a-z]+)".*/\1/')
    case "$STATUS" in
      succeeded) log "snapshot siap dalam $((SECONDS - STARTED))s"; break ;;
      failed|canceled)
        printf '%s' "$BODY" | head -c 400 >&2
        fail "snapshot $STATUS"
        ;;
    esac
    [ $((SECONDS - STARTED)) -lt "$TIMEOUT" ] || fail "timeout selepas ${TIMEOUT}s"
    sleep 2
  done

  SNAP=$(ls -1t "$SNAP_DIR"/*.snapshot 2>/dev/null | head -1)
  [ -n "$SNAP" ] || fail "tiada fail .snapshot dalam $SNAP_DIR"
  SIZE=$(du -h "$SNAP" | cut -f1)
  KEY="meilisearch/$(date -u +%Y/%m/%d)/meili_data-$(date -u +%Y%m%dT%H%M%SZ).snapshot"
  log "memuat naik $SNAP ($SIZE) -> $R2_BUCKET/$KEY"

  curl -sf -m 900 --aws-sigv4 "aws:amz:$R2_REGION:s3" \
    --user "$R2_ACCESS_KEY_ID:$R2_SECRET_ACCESS_KEY" \
    -T "$SNAP" \
    -H "Content-Type: application/octet-stream" \
    "$R2_ENDPOINT/$R2_BUCKET/$KEY" \
    || fail "muat naik R2 gagal"

  REMOTE=$(curl -sf -m 30 --aws-sigv4 "aws:amz:$R2_REGION:s3" \
    --user "$R2_ACCESS_KEY_ID:$R2_SECRET_ACCESS_KEY" \
    "$R2_ENDPOINT/$R2_BUCKET/$KEY" | wc -c)
  LOCAL=$(stat -c%s "$SNAP")
  [ "$REMOTE" = "$LOCAL" ] || fail "saiz tidak sepadan: local=$LOCAL remote=$REMOTE"
  log "sahkan saiz OK ($LOCAL bait)"

  prune_local '*.snapshot'
fi

log "selesai"
