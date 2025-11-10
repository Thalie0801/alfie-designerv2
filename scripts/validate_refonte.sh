#!/usr/bin/env bash
set -euo pipefail

FILES=$(git ls-files \
  | grep -E '\.(ts|tsx|js|jsx)$' \
  | grep -vE '(\.spec\.|\.test\.|/tests/)' \
  | grep -v '^scripts/codex/')
FAIL=0

for f in $FILES; do
  CONTENT=$(sed -E '/^\s*\/\//d; s/\/\*.*\*\///g' "$f")
  echo "$CONTENT" | grep -nE '\brouter\.push\s*\(' >/dev/null && { echo "$f: contient router.push("; FAIL=1; }
  echo "$CONTENT" | grep -nE '\bpublish\b' >/dev/null && { echo "$f: contient publish"; FAIL=1; }
done

if [ $FAIL -eq 1 ]; then
  echo "Error: Des références interdites subsistent (router.push|publish)."
  exit 1
fi

echo "[validate] OK"
