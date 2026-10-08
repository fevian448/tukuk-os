#!/usr/bin/env bash
# IndexNow — beritahu enjin carian (Bing, Yandex, Naver, Seznam...) bila
# kandungan tukuk.org bertambah / berubah / dipadam.
# Rujukan: https://www.indexnow.org/documentation
#
# Guna:
#   ./scripts/indexnow.sh                          # hantar SEMUA URL dari sitemap.xml hidup
#   ./scripts/indexnow.sh https://tukuk.org/blog   # hantar SATU URL (mod GET)
#   ./scripts/indexnow.sh URL1 URL2 ...            # hantar beberapa URL (mod POST)
#
# Respon: 200 = OK, 202 = diterima (validation kunci pending).
# Kunci dihos public by design di https://tukuk.org/<key>.txt (Option 1 IndexNow).
set -euo pipefail

KEY="${INDEXNOW_KEY:-bd8f0317c5ab4cddb9a3dc62f7ec15ae}"
HOST="tukuk.org"
API="https://api.indexnow.org/indexnow"
KEYLOC="https://tukuk.org/${KEY}.txt"

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  grep '^#' "$0" | sed 's/^# \{0,1\}//'
  exit 0
fi

submit_get() { # satu URL — URL mesti URL-escaped (RFC 3986)
  local code
  code=$(curl -s -o /tmp/indexnow-get.log -w '%{http_code}' --get "$API" \
    --data-urlencode "url=$1" \
    --data-urlencode "key=$KEY" \
    --data-urlencode "keyLocation=$KEYLOC")
  printf 'HTTP %s  %s\n' "$code" "$1"
  case "$code" in 200 | 202) return 0 ;; *)
    sed 's/^/    /' /tmp/indexnow-get.log 2>/dev/null || true
    return 1 ;;
  esac
}

submit_post() { # senarai URL ($@) — sehingga 10,000 URL sekali POST
  local json_urls url sep=''
  json_urls=''
  for url in "$@"; do
    json_urls+="${sep}\"${url}\""
    sep=','
  done
  local payload="{\"host\":\"${HOST}\",\"key\":\"${KEY}\",\"keyLocation\":\"${KEYLOC}\",\"urlList\":[${json_urls}]}"
  local code
  code=$(curl -s -o /tmp/indexnow-post.log -w '%{http_code}' \
    -X POST "$API" \
    -H 'Content-Type: application/json; charset=utf-8' \
    -d "$payload")
  printf 'HTTP %s  %s URL dihantar\n' "$code" "$#"
  case "$code" in 200 | 202) return 0 ;; *)
    sed 's/^/    /' /tmp/indexnow-post.log 2>/dev/null || true
    return 1 ;;
  esac
}

if [[ $# -ge 1 && "$1" != "-" && "$1" != "all" ]]; then
  if [[ $# -eq 1 ]]; then submit_get "$1"; else submit_post "$@"; fi
  exit $?
fi

# Tiada argumen → kutip semua URL dari sitemap hidup, hantar sekali gus.
mapfile -t URLS < <(curl -fsS "https://tukuk.org/sitemap.xml" | grep -oE '<loc>[^<]+' | sed 's/<loc>//')
if [[ ${#URLS[@]} -eq 0 ]]; then
  echo 'Gagal: tiada URL ditemui dalam sitemap.xml' >&2
  exit 1
fi
submit_post "${URLS[@]}"
