#!/usr/bin/env bash
# cloud-setup.sh — prépare l'environnement cloud (monorepo) : installe les deps de
# chaque projet Node. Idempotent. À pointer depuis la config de l'environnement cloud.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
for dir in "$ROOT"/*/; do
  [ -f "$dir/package.json" ] || continue
  echo "→ deps: $(basename "$dir")"
  ( cd "$dir" && { [ -f package-lock.json ] && npm ci || npm install; } )
done
echo "cloud-setup terminé"
