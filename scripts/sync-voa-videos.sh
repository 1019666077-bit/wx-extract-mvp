#!/usr/bin/env bash
# Mirror VOA public-domain MP4s locally and write miniprogram/data/video-map.json.
# COS upload is optional and is skipped when credentials are missing (exit 0).
# Secrets stay on the operator machine: .env.cos / ~/.cos.yaml — never commit them.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE="$ROOT/data/lessons.json"
MAP_PATH="$ROOT/miniprogram/data/video-map.json"
MIRROR_DIR="$ROOT/mirror/mp4"
OBJECT_PREFIX="lle/mp4"
BASE_URL="${MP_VIDEO_BASE_URL:-https://media.example.com}"
DRY_RUN=0
SKIP_DOWNLOAD=0
SKIP_UPLOAD=0
ONLY_IDS=""

usage() {
  cat <<'EOF'
Usage: bash scripts/sync-voa-videos.sh [options]

  --dry-run                 Print the lesson list only; do not download, upload, or write the map
  --only id,id              Limit to these lesson ids (e.g. lle1-01,lle1-02)
  --skip-download           Assume mirror/ already has files
  --skip-upload             Do not attempt COS upload
  --base-url URL            Override MP_VIDEO_BASE_URL (no trailing slash)
  --mirror-dir PATH         Local MP4 directory (default ./mirror/mp4)

Environment (operator machine only; do not commit):
  MP_VIDEO_BASE_URL   e.g. https://media.example.com
  COS_BUCKET          target bucket
  COS_REGION          default ap-shanghai
  COS_SECRET_ID / COS_SECRET_KEY  or ~/.cos.yaml / .env.cos (gitignored)

Upload runs only when coscli + COS_BUCKET + credentials are present.
Missing credentials prints a skip line and exits 0.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1; shift ;;
    --skip-download) SKIP_DOWNLOAD=1; shift ;;
    --skip-upload) SKIP_UPLOAD=1; shift ;;
    --only)
      ONLY_IDS="${2:-}"
      shift 2
      ;;
    --base-url)
      BASE_URL="${2:-}"
      shift 2
      ;;
    --mirror-dir)
      MIRROR_DIR="${2:-}"
      shift 2
      ;;
    -h|--help) usage; exit 0 ;;
    *)
      echo "error: unknown option $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

BASE_URL="${BASE_URL%/}"

if [[ -f "$ROOT/.env.cos" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env.cos"
  set +a
fi

if [[ ! -f "$SOURCE" ]]; then
  echo "error: missing $SOURCE" >&2
  exit 1
fi

LIST_FILE="$(mktemp)"
trap 'rm -f "$LIST_FILE"' EXIT

python3 - "$SOURCE" "$ONLY_IDS" "$LIST_FILE" <<'PY'
import json
import sys

source, only_ids, out_path = sys.argv[1], sys.argv[2], sys.argv[3]
wanted = {item.strip() for item in only_ids.split(",") if item.strip()}
payload = json.loads(open(source, encoding="utf-8").read())
rows = []
for level in payload.get("levels") or []:
    for lesson in level.get("lessons") or []:
        lesson_id = lesson.get("id")
        url = lesson.get("videoUrl") or ""
        if not lesson_id or not url:
            continue
        if wanted and lesson_id not in wanted:
            continue
        rows.append((lesson_id, url))
if wanted:
    missing = [item for item in wanted if item not in {row[0] for row in rows}]
    if missing:
        print("error: unknown lesson id(s): " + ", ".join(sorted(missing)), file=sys.stderr)
        sys.exit(1)
with open(out_path, "w", encoding="utf-8") as handle:
    for lesson_id, url in rows:
        handle.write(f"{lesson_id}\t{url}\n")
print(f"listed {len(rows)} lesson(s)", file=sys.stderr)
PY

count=0
while IFS=$'\t' read -r lesson_id source_url; do
  [[ -z "${lesson_id:-}" ]] && continue
  count=$((count + 1))
  dest="$MIRROR_DIR/${lesson_id}.mp4"
  mirror_url="${BASE_URL}/${OBJECT_PREFIX}/${lesson_id}.mp4"
  echo "${lesson_id}  src=${source_url}  dest=${dest}  map=${mirror_url}"
done < "$LIST_FILE"

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "dry-run: ${count} lesson(s); no download, upload, or video-map write"
  exit 0
fi

mkdir -p "$MIRROR_DIR"

if [[ "$SKIP_DOWNLOAD" -eq 0 ]]; then
  while IFS=$'\t' read -r lesson_id source_url; do
    [[ -z "${lesson_id:-}" ]] && continue
    dest="$MIRROR_DIR/${lesson_id}.mp4"
    if [[ "$source_url" != https://voa-video-ns.akamaized.net/* ]]; then
      echo "skip download ${lesson_id}: source host is not VOA Akamai" >&2
      continue
    fi
    if [[ -s "$dest" ]]; then
      echo "skip download ${lesson_id}: already at ${dest}"
      continue
    fi
    echo "download ${lesson_id}"
    curl -fL --retry 3 --retry-delay 2 -o "${dest}.partial" "$source_url"
    mv "${dest}.partial" "$dest"
  done < "$LIST_FILE"
else
  echo "skip download: --skip-download"
fi

cos_ready=1
if [[ "$SKIP_UPLOAD" -eq 1 ]]; then
  echo "skip upload: --skip-upload"
  cos_ready=0
elif ! command -v coscli >/dev/null 2>&1; then
  echo "skip upload: coscli not installed (operator-only; template: coscli cp FILE cos://\$COS_BUCKET/${OBJECT_PREFIX}/ID.mp4)"
  cos_ready=0
elif [[ -z "${COS_BUCKET:-}" ]]; then
  echo "skip upload: COS_BUCKET unset"
  cos_ready=0
elif [[ -z "${COS_SECRET_ID:-}" && ! -f "${HOME}/.cos.yaml" && ! -f "$ROOT/.cos.yaml" ]]; then
  echo "skip upload: no COS credentials (use COS_SECRET_ID/KEY, ~/.cos.yaml, or gitignored .env.cos)"
  cos_ready=0
fi

if [[ "$cos_ready" -eq 1 ]]; then
  region="${COS_REGION:-ap-shanghai}"
  while IFS=$'\t' read -r lesson_id source_url; do
    [[ -z "${lesson_id:-}" ]] && continue
    dest="$MIRROR_DIR/${lesson_id}.mp4"
    if [[ ! -s "$dest" ]]; then
      echo "skip upload ${lesson_id}: missing ${dest}" >&2
      continue
    fi
    remote="cos://${COS_BUCKET}/${OBJECT_PREFIX}/${lesson_id}.mp4"
    echo "coscli cp ${dest} ${remote} --region ${region}"
    coscli cp "$dest" "$remote" --region "$region"
  done < "$LIST_FILE"
fi

python3 - "$MAP_PATH" "$BASE_URL" "$OBJECT_PREFIX" "$ONLY_IDS" "$LIST_FILE" <<'PY'
import json
import sys
from datetime import datetime, timezone, timedelta

map_path, base_url, prefix, only_ids, list_path = sys.argv[1:6]
existing = {}
try:
    existing = json.loads(open(map_path, encoding="utf-8").read())
except FileNotFoundError:
    existing = {}
lessons = dict(existing.get("lessons") or {}) if only_ids else {}
with open(list_path, encoding="utf-8") as handle:
    for line in handle:
        line = line.strip()
        if not line:
            continue
        lesson_id = line.split("\t", 1)[0]
        lessons[lesson_id] = f"{base_url}/{prefix}/{lesson_id}.mp4"
payload = {
    "version": 1,
    "baseUrl": base_url,
    "objectPrefix": prefix,
    "generatedAt": datetime.now(timezone(timedelta(hours=8))).replace(microsecond=0).isoformat(),
    "lessons": dict(sorted(lessons.items())),
}
with open(map_path, "w", encoding="utf-8") as handle:
    json.dump(payload, handle, ensure_ascii=False, indent=2)
    handle.write("\n")
print(f"wrote {map_path} ({len(lessons)} lesson urls)")
PY
