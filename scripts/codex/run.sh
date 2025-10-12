#!/usr/bin/env bash
set -euo pipefail

# Refonte V1 — Runner Codex (no-install)
# - Exécute le codemod en excluant la landing (pages publiques dans src/pages)
# - N’effectue AUCUNE installation npm (évite l’erreur 403)

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo ".")"
cd "$ROOT"

command -v npx >/dev/null 2>&1 || { echo "node/npm requis. Abandon."; exit 1; }

# Cibles (TS/TSX/JS/JSX) hors landing (src/pages) / docs
TARGETS=(
  "apps/**/*.{ts,tsx,js,jsx}"
  "packages/**/*.{ts,tsx,js,jsx}"
  "services/**/*.{ts,tsx,js,jsx}"
)

IGNORE_PATTERNS=(
  "src/pages/Index.tsx"
  "src/pages/Contact.tsx"
  "src/pages/DevenirPartenaire.tsx"
  "src/pages/FAQ.tsx"
  "src/pages/Legal.tsx"
  "src/pages/Privacy.tsx"
  "www"
  "site"
  "node_modules"
  "dist"
  "build"
  ".next"
  "docs"
)

# Construire les --ignore-pattern
JSC_IGNORE=()
for p in "${IGNORE_PATTERNS[@]}"; do
  JSC_IGNORE+=("--ignore-pattern" "$p")
done

echo "[codex] Running codemod with npx jscodeshift@0.15.2 (no install)…"
npx -y jscodeshift@0.15.2 \
  --parser=tsx \
  --extensions=ts,tsx,js,jsx \
  -t scripts/codex/refonte-codemod.js \
  "${JSC_IGNORE[@]}" \
  "${TARGETS[@]}"

echo "[codex] Done."

