#!/usr/bin/env bash
# Hook SessionStart : accueil adapté au scope de la session.
#   - worktree lié → session isolée : oriente vers /start (qui décide quoi faire).
#   - checkout principal → oriente vers le lanceur Atelier.command (local ou cloud).
set -uo pipefail

emit() {
  jq -nc --arg c "$1" '{hookSpecificOutput:{hookEventName:"SessionStart",additionalContext:$c}}' 2>/dev/null \
    || printf '%s\n' "$1"
}

git rev-parse --git-dir >/dev/null 2>&1 || { emit "🛠️ Atelier (hors dépôt git)."; exit 0; }
gd="$(git rev-parse --absolute-git-dir 2>/dev/null)"
gcd="$(cd "$(git rev-parse --git-common-dir 2>/dev/null)" 2>/dev/null && pwd -P)"
super="$(git rev-parse --show-superproject-working-tree 2>/dev/null)"
branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '')"

# Worktree lié = git-dir distinct du git-dir commun, et pas un sous-module.
if [ -n "$gd" ] && [ "$gd" != "$gcd" ] && [ -z "$super" ]; then
  emit "🛠️ Session isolée (branche \`$branch\`). Lance \`/start\` pour décider quoi faire. Jamais de commit sur main ; push de branche = preview, PR mergée = prod."
else
  emit "🛠️ Atelier — **checkout principal**. Pour bosser, lance le lanceur **\`Atelier.command\`** (local ou cloud) ; il ne fait que sandboxer, tout le reste se décide dans \`/start\`. Le garde-fou interdit le dev projet ici."
fi
exit 0
