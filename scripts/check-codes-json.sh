#!/usr/bin/env bash
# Fail if the public allowlist contains redeem codes.
# Public-repo inventory must stay empty; operators issue codes privately.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FILE="$ROOT/data/codes.json"

if [[ ! -f "$FILE" ]]; then
  echo "error: missing $FILE" >&2
  exit 1
fi

python3 - "$FILE" <<'PY'
import json
import sys

path = sys.argv[1]
with open(path, encoding="utf-8") as handle:
    payload = json.load(handle)
codes = payload.get("codes")
if not isinstance(codes, list):
    print("error: data/codes.json must have a codes array", file=sys.stderr)
    sys.exit(1)
if len(codes) > 0:
    print(f"error: data/codes.json must stay empty in the public repo (found {len(codes)} entries)", file=sys.stderr)
    sys.exit(1)
print("ok: data/codes.json is empty")
PY
