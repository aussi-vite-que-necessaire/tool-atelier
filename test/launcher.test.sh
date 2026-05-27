#!/usr/bin/env bash
# Test du lanceur Atelier.command : il ouvre une session locale isolée et y lance /start.
# ATELIER_DRY_RUN=1 fait imprimer la commande de lancement au lieu de l'exec.
set -uo pipefail
fail() { echo "FAIL: $1" >&2; exit 1; }
ATELIER="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
CMD="$ATELIER/Atelier.command"

# Lance un worktree natif isolé.
out="$(ATELIER_DRY_RUN=1 "$CMD")" || fail "le lanceur a échoué"
printf '%s' "$out" | grep -q "claude --worktree" || fail "ne lance pas 'claude --worktree' (got: $out)"

# Déclenche /start, séparé par `--` pour ne pas être pris comme nom de worktree.
printf '%s' "$out" | grep -q -- "-- /start" || fail "ne déclenche pas /start via prompt séparé (got: $out)"

# Local-only : aucune trace de cloud/remote.
printf '%s' "$out" | grep -qiE "remote|cloud" && fail "le lanceur évoque encore le cloud (got: $out)"

echo "OK launcher.test.sh"
