#!/usr/bin/env bash
# Hook SessionStart : accueil adapté au scope de la session (le hook lit son cwd).
#   - worktree lié sur work/<projet>-… → accueil projet (pas de menu).
#   - worktree lié sur chore/atelier-… → accueil plomberie.
#   - autre worktree lié → accueil session isolée.
#   - checkout principal → pointe vers le launcher `lab`.
set -uo pipefail

emit() {
  jq -nc --arg c "$1" '{hookSpecificOutput:{hookEventName:"SessionStart",additionalContext:$c}}' 2>/dev/null \
    || printf '%s\n' "$1"
}

git rev-parse --git-dir >/dev/null 2>&1 || { emit "🛠️ Atelier (hors dépôt git)."; exit 0; }
branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '')"
gd="$(git rev-parse --absolute-git-dir 2>/dev/null)"
gcd="$(cd "$(git rev-parse --git-common-dir 2>/dev/null)" 2>/dev/null && pwd -P)"
root="$(git rev-parse --show-toplevel 2>/dev/null)"
linked=0; [ -n "$gd" ] && [ "$gd" != "$gcd" ] && linked=1

proj=""
case "$branch" in
  work/*)
    for d in "$root"/*/; do
      [ -f "$d/Dockerfile" ] || continue
      p="$(basename "$d")"
      if [ "$branch" = "work/$p" ] || [ "${branch#work/$p-}" != "$branch" ]; then proj="$p"; break; fi
    done ;;
esac

if [ "$linked" = "1" ] && [ -n "$proj" ]; then
  emit "🛠️ Session sur **$proj** (branche \`$branch\`). Lis \`$proj/CLAUDE.md\`, travaille uniquement dans \`$proj/\`. On continue ? Rappel : jamais de commit sur main ; push de branche = preview, PR mergée = prod."
elif [ "$linked" = "1" ] && [ "${branch#chore/atelier-}" != "$branch" ]; then
  emit "🛠️ Session **plomberie de l'atelier** (branche \`$branch\`). Tu peux faire évoluer \`CLAUDE.md\`, les skills, \`bin/lab\`, les hooks. Jamais de commit sur main ; livraison par PR."
elif [ "$linked" = "1" ]; then
  emit "🛠️ Session isolée (branche \`$branch\`). Jamais de commit sur main ; livraison par PR."
else
  emit "🛠️ Atelier — **checkout principal**. Pour bosser, lance \`lab\` (ou double-clique \`Atelier.command\`) et choisis quoi faire. Déjà dans claude ici ? Lance \`/start\`. Le garde-fou interdit le dev projet dans le checkout principal."
fi
exit 0
