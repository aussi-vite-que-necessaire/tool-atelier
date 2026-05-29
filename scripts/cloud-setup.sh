#!/usr/bin/env bash
# cloud-setup.sh — prépare l'environnement cloud (monorepo) : installe l'outillage
# système manquant puis les deps de chaque projet Node. Idempotent. À pointer depuis
# la config de l'environnement cloud (champ « Setup script »).
#
# NB : pour que bin/lab-ssh joigne le serveur lab (SSH, port 22), l'environnement
# cloud doit être en Network access « Full » — le défaut « Trusted » bloque le 22.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"

# Client SSH : pas préinstallé dans l'image cloud, requis par bin/lab-ssh.
if ! command -v ssh >/dev/null 2>&1; then
  echo "→ install openssh-client"
  apt-get update -y && apt-get install -y openssh-client || true
fi
for dir in "$ROOT"/projects/*/; do
  [ -f "$dir/package.json" ] || continue
  echo "→ deps: $(basename "$dir")"
  ( cd "$dir" && { [ -f package-lock.json ] && npm ci || npm install; } )
done
echo "cloud-setup terminé"
