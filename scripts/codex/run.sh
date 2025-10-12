#!/usr/bin/env bash
set -euo pipefail

# Refonte V1 — Runner Codex
# - Exécute le codemod JS/TS/TSX en excluant la landing
# - Met à jour package.json si besoin (jscodeshift)
# - Ne touche pas apps/landing, www, site

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo ".")"
cd "$ROOT"

if ! command -v npx &>/dev/null; then
  echo "node/npm requis. Abandon."; exit 1
fi

# Ajouter jscodeshift si absent
if ! npx --yes jscodeshift --version &>/dev/null; then
  echo "[codex] Ajout de jscodeshift en devDependency…"
  npm pkg set devDependencies.jscodeshift="^0.15.2" >/dev/null 2>&1 || true
  npm install --silent
fi

TARGETS=(
  "apps/**/**/*.ts"
  "apps/**/**/*.tsx"
  "packages/**/**/*.ts"
  "packages/**/**/*.tsx"
  "services/**/**/*.ts"
  "services/**/**/*.tsx"
  "apps/**/**/*.js"
  "apps/**/**/*.jsx"
)

IGNORE="apps/landing|^www/|^site/"

echo "[codex] Lancement codemod (exclusion: ${IGNORE})…"
npx jscodeshift -t scripts/codex/refonte-codemod.js "${TARGETS[@]}" \
  --ignore-pattern "${IGNORE}" --parser ts --extensions=ts,tsx,js,jsx || true

echo "[codex] Formatage (si prettier dispo)…"
if npx --yes prettier -v &>/dev/null; then
  npx prettier -w .
fi

echo "[codex] Vérification: aucune modif de la landing…"
if git diff --name-only | grep -E '^(apps/landing|www/|site/)' >/dev/null; then
  echo "ERREUR: le codemod a tenté de modifier la landing. Revert requis."
  exit 2
fi

echo "[codex] OK."
