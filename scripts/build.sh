#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
"$ROOT/scripts/validate.sh"
VERSION="$(python3 - <<'PY' "$ROOT/extension/manifest.json"
import json,sys
print(json.load(open(sys.argv[1],encoding='utf-8'))['version'])
PY
)"
mkdir -p "$ROOT/dist"
OUT="$ROOT/dist/chat-copy-v${VERSION}-firefox.zip"
rm -f "$OUT"
(
  cd "$ROOT/extension"
  zip -qr "$OUT" .
)
echo "Built: $OUT"
