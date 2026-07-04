#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."

CHECK_OUTPUT=$(node -e "require('better-sqlite3')" 2>&1) && CHECK_OK=1 || CHECK_OK=0

if [ "$CHECK_OK" -eq 0 ]; then
  if echo "$CHECK_OUTPUT" | grep -q "NODE_MODULE_VERSION"; then
    echo "[start] better-sqlite3 native binding ABI mismatch, rebuilding..."
    npm rebuild better-sqlite3
  else
    echo "[start] native module check failed:"
    echo "$CHECK_OUTPUT"
    exit 1
  fi
fi

exec node src/index.js
