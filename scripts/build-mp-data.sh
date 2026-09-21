#!/usr/bin/env bash
# Generate miniprogram catalog + per-lesson JSON (no video URLs).
# Mirror URLs stay in miniprogram/data/video-map.json (sync-voa-videos.sh).
# Usage:
#   bash scripts/build-mp-data.sh          # write generated files
#   bash scripts/build-mp-data.sh --check  # fail if generated files are stale
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec python3 "$ROOT/scripts/build_mp_data.py" "$@"
