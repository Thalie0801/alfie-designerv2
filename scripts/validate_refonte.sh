#!/usr/bin/env bash
set -euo pipefail
# Fail si des occurrences interdites (ancienne logique Canva push / auto-pub) subsistent dans le code (hors node_modules et docs)
echo "[validate] scanning repository…"
if git grep -nE "(push.*canva|auto.?publish)" -- ':!node_modules' ':!docs' ':!*.md' ':!.github/workflows/*.yml' | grep -vE 'scripts/codex/refonte-codemod.js' ; then
  echo "::error::Des références push/publish subsistent. La V1 est PULL uniquement (Canva + ZIP)."
  exit 1
fi

if ! git grep -n "buildTags(" -- ':!node_modules' ':!docs' ':!*.md' ':!.github/workflows/*.yml' >/dev/null; then
  echo "::error::Les uploads Cloudinary doivent utiliser buildTags()."
  exit 1
fi

echo "[validate] OK"
