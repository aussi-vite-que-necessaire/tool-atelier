#!/usr/bin/env bash
# Hook SessionStart : injecte une instruction pour que l'agent OUVRE en demandant à Manu ce qu'il
# veut faire (le routeur). Un hook ne peut pas poser de question ; il injecte du contexte.
set -uo pipefail

read -r -d '' CTX <<'EOF'
🛠️ Atelier ouvert (monorepo tool-atelier). AVANT toute action, accueille Manu et demande ce qu'il veut faire :
  1. Bosser sur un projet existant
  2. Créer un projet
  3. Lister les projets (et leur état)
  4. Infra / plateforme (renvoie vers cockpit)
  5. Autre
Puis enchaîne avec la skill /start (qui orchestre le bon process). Règle absolue : JAMAIS de commit sur `main` — toujours une branche + PR (le hook branch-guard le rappelle). Un push de branche = preview ; merge de PR = prod.
EOF

# Format de sortie SessionStart : additionalContext injecté dans la session.
jq -nc --arg c "$CTX" '{hookSpecificOutput:{hookEventName:"SessionStart", additionalContext:$c}}' 2>/dev/null \
  || printf '%s\n' "$CTX"   # repli : si jq absent, le texte brut sert quand même de contexte
exit 0
