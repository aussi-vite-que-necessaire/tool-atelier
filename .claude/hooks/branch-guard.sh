#!/usr/bin/env bash
# Hook PreToolUse — garde-fou de l'atelier (modèle cloud : 1 session = 1 conteneur isolé = 1 branche).
#   Seul invariant : jamais de commit/push qui mettrait `main`/`master` à jour.
#   L'isolation entre sessions est structurelle (conteneur + branche dédiée fournie à la session),
#   pas un worktree git → aucune règle sur les dossiers projet ni sur les changements de branche :
#   dans son conteneur, l'agent est seul, il fait ce qu'il veut tant qu'il ne corrompt pas main.
# Lit le JSON du hook sur stdin. Fail-open si jq/git absents ou hors repo.
set -uo pipefail

json="$(cat)"
command -v jq  >/dev/null 2>&1 || exit 0
command -v git >/dev/null 2>&1 || exit 0

cwd="$(printf '%s' "$json"  | jq -r '.cwd // "."')"
cmd="$(printf '%s' "$json"  | jq -r '.tool_input.command // ""')"

cd "$cwd" 2>/dev/null || exit 0
git rev-parse --git-dir >/dev/null 2>&1 || exit 0

branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")"

# Sur main/master : jamais de commit, ni de push mettant à jour main. La suppression d'une
# branche distante (git push --delete / -d) ne touche pas main → autorisée (nettoyage des
# branches mergées/abandonnées sans contourner par l'API).
if [ "$branch" = "main" ] || [ "$branch" = "master" ]; then
  case "$cmd" in
    *"git commit"*)
      printf 'Bloqué : jamais de commit sur "%s". Tu es dans une session isolée — bascule sur ta branche de session (git switch -c <branche>) puis ouvre une PR.\n' "$branch" >&2
      exit 2 ;;
    *"git push"*)
      case "$cmd" in
        *" --delete"*|*" -d "*) : ;;   # suppression d'une branche distante → autorisée
        *)
          printf 'Bloqué : jamais de push sur "%s". Tu es dans une session isolée — bascule sur ta branche de session (git switch -c <branche>) puis ouvre une PR.\n' "$branch" >&2
          exit 2 ;;
      esac ;;
  esac
fi

exit 0
