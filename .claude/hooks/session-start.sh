#!/usr/bin/env bash
# Hook SessionStart : accueil de session. Modèle cloud — 1 session = 1 conteneur isolé = 1 branche.
# On annonce la branche courante. Le dev de feature passe par le workflow superpowers ;
# l'atelier ajoute quelques skills dédiées (/nouveau-projet, /noter-idee, /travailler-infra, /apercu, lab-ssh).
set -uo pipefail

emit() {
  jq -nc --arg c "$1" '{hookSpecificOutput:{hookEventName:"SessionStart",additionalContext:$c}}' 2>/dev/null \
    || printf '%s\n' "$1"
}

git rev-parse --git-dir >/dev/null 2>&1 || { emit "🛠️ Atelier (hors dépôt git)."; exit 0; }
branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '')"

base="Dis ce que tu veux faire — le dev de feature passe par superpowers ; skills atelier : \`/nouveau-projet\`, \`/noter-idee\`, \`/travailler-infra\`, \`/apercu\` (l'œil sur le front), \`lab-ssh\`. Jamais de commit sur main ; push de branche = preview, PR mergée = intégration (suite assemblée sur *.preview), prod = promotion explicite."

if [ "$branch" = "main" ] || [ "$branch" = "master" ]; then
  emit "🛠️ Atelier — tu es sur \`$branch\`. Avant de coder, bascule sur ta branche de session (\`git switch -c <branche>\`). $base"
else
  emit "🛠️ Atelier — session isolée sur la branche \`$branch\`. $base"
fi
exit 0
