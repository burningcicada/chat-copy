#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
python3 - <<'PY' "$ROOT/extension/manifest.json"
import json,sys
with open(sys.argv[1],encoding='utf-8') as f:
    m=json.load(f)
assert m['name']=='Chat Copy'
assert m['manifest_version']==2
print('manifest.json: OK')
PY
node --check "$ROOT/extension/background.js"
node --check "$ROOT/extension/content.js"
if grep -RInE '1084763196296|t255o03d2og5o1cmco7gso7vo5001c34' "$ROOT/extension" "$ROOT/docs" "$ROOT/README.md" "$ROOT/PRIVACY.md" "$ROOT/SECURITY.md"; then
  echo 'ERROR: personal OAuth identifier found' >&2
  exit 1
fi
if grep -RInE 'client_secret[^[:space:]]*\.json' "$ROOT/extension"; then
  echo 'ERROR: credential file reference found in extension source' >&2
  exit 1
fi
echo 'JavaScript syntax: OK'
echo 'credential sanity check: OK'
