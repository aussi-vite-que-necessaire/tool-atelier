#!/usr/bin/env bash
# Atelier — lanceur. Ne fait qu'une chose : sandboxer le dev. Ouvre une session isolée sur ta
# machine — worktree natif de Claude Code (claude --worktree) : copie isolée du dépôt, branche
# dédiée, auto-nettoyée si rien n'est produit — et y lance /start.
# Le prompt /start est séparé par `--` : sans ça, `--worktree` le prendrait comme nom de worktree.
# Tout le « quoi faire » (projet, création, plomberie) se décide à l'intérieur, dans /start.
# ATELIER_DRY_RUN=1 imprime la commande au lieu de l'exécuter (tests).
set -euo pipefail

cd "$(dirname "$0")" || exit 1

if [ -n "${ATELIER_DRY_RUN:-}" ]; then
  printf 'claude --worktree -- /start\n'
else
  exec claude --worktree -- /start
fi
