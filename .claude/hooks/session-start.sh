#!/usr/bin/env bash
# Hook SessionStart : accueil de session. Modèle cloud — 1 session = 1 conteneur isolé = 1 branche.
# On annonce la branche courante et on oriente vers /start (qui décide quoi faire).
set -uo pipefail

emit() {
  jq -nc --arg c "$1" '{hookSpecificOutput:{hookEventName:"SessionStart",additionalContext:$c}}' 2>/dev/null \
    || printf '%s\n' "$1"
}

git rev-parse --git-dir >/dev/null 2>&1 || { emit "🛠️ Atelier (hors dépôt git)."; exit 0; }
branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '')"

if [ "$branch" = "main" ] || [ "$branch" = "master" ]; then
  emit "🛠️ Atelier — tu es sur \`$branch\`. Avant de coder, bascule sur ta branche de session (\`git switch -c <branche>\`). Lance \`/start\` pour décider quoi faire. Jamais de commit sur main ; push de branche = preview, PR mergée = prod."
else
  emit "🛠️ Atelier — session isolée sur la branche \`$branch\`. Lance \`/start\` pour décider quoi faire. Jamais de commit sur main ; push de branche = preview, PR mergée = prod."
fi
exit 0
