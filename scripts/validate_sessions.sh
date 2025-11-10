#!/usr/bin/env bash
set -euo pipefail

echo "Checking for landing/site modifications..."
if git diff --name-only ${1:-HEAD} | grep -E '^(apps/landing/|www/|site/)' > /dev/null; then
  echo "Error: landing or site files modified." >&2
  exit 1
fi

echo "Checking Supabase edge functions..."
if ! test -f supabase/functions/ping/index.ts; then
  echo "Missing supabase/functions/ping/index.ts" >&2
  exit 1
fi

echo "All checks passed."
