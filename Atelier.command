#!/usr/bin/env bash
# Atelier — lanceur. Ne fait qu'une chose : sandboxer le dev. Une seule question : local ou cloud.
#   local → session isolée sur ta machine (worktree natif de Claude Code : claude --worktree).
#   cloud → session sur claude.ai (claude --remote si le CLI le supporte ; sinon ouvre le web).
# Tout le « quoi faire » (projet, création, plomberie) se décide à l'intérieur, dans la skill /start.
# ATELIER_DRY_RUN=1 imprime la commande au lieu de l'exécuter, et n'ouvre pas le navigateur (tests).
set -euo pipefail

cd "$(dirname "$0")" || exit 1

# Amorçage cloud : ne décide d'aucune tâche, déclenche seulement le menu /start.
CLOUD_BOOTSTRAP="Lance la skill /start : demande-moi ce que je veux faire dans cette session et oriente-moi vers la bonne skill. Ne choisis aucune tâche toi-même, attends ma réponse."
CLOUD_WEB="https://claude.ai/code"

# Le CLI installé propose-t-il le lancement de session cloud (--remote) ?
remote_supported() { claude --help 2>/dev/null | grep -qE -- '--remote([^-]|$)'; }

run() {  # imprime (dry-run) ou exec la commande passée
  if [ -n "${ATELIER_DRY_RUN:-}" ]; then printf '%s\n' "$*"; else exec "$@"; fi
}

launch() {
  case "$1" in
    local)
      run claude --worktree ;;
    cloud)
      if remote_supported; then
        run claude --remote "$CLOUD_BOOTSTRAP"
      else
        echo "Atelier: ce CLI claude ne propose pas (encore) le lancement de session cloud (--remote)." >&2
        echo "Démarre la session cloud sur le web : $CLOUD_WEB — puis lance /start dedans." >&2
        [ -z "${ATELIER_DRY_RUN:-}" ] && command -v open >/dev/null 2>&1 && open "$CLOUD_WEB"
        return 0
      fi ;;
    *) echo "Atelier: mode inconnu: $1" >&2; return 2 ;;
  esac
}

# Mode en argument (tests/usage avancé) sinon demandé interactivement.
mode="${1:-}"
if [ -z "$mode" ]; then
  printf 'Atelier — nouvelle session isolée.\n' >&2
  printf '  1) local  — sur ta machine\n' >&2
  printf '  2) cloud  — sur claude.ai (autonome, pilotée au navigateur)\n' >&2
  printf 'local ou cloud ? [1/2] ' >&2
  read -r c
  case "$c" in
    1|local|l|L) mode=local ;;
    2|cloud|c|C) mode=cloud ;;
    *) echo "Atelier: choix invalide" >&2; exit 1 ;;
  esac
fi
launch "$mode"
