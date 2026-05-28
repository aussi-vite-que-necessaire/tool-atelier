---
name: start
description: Entrée de session de l'atelier — demande à Manu ce qu'il veut faire dans cette session et l'oriente vers la bonne skill. Le lanceur Atelier.command la déclenche automatiquement à l'ouverture d'une session locale ; en session cloud (web), lance-la toi-même.
---

# /start — entrée de session

Entrée **principale** de toute session de l'atelier. Le lanceur `Atelier.command` ouvre une
session isolée locale et déclenche cette skill ; en session cloud (web), on la lance soi-même.
Une session déjà focalisée sur un projet n'a pas besoin d'y repasser.

Trois rails, trois skills :

| Choix | Skill |
|---|---|
| Travailler sur un projet existant | `/lab-ship <projet>` |
| Créer un nouveau projet | `/lab-new` |
| Plomberie de l'atelier (skills, CLAUDE.md, scripts) | `/lab-meta` |

## Flow

**Étape 1 — Pose la question principale** via `AskUserQuestion` (en cloud sans UI : en prose) :

> Qu'est-ce qu'on fait dans cette session ?
> - Travailler sur un projet existant
> - Créer un nouveau projet
> - Plomberie de l'atelier

**Étape 2 — Selon le choix :**

### A) Projet existant

Scanne les projets en lisant chaque `projects/*/lab.json` :

```bash
for f in projects/*/lab.json; do
  dir=$(basename "$(dirname "$f")")
  desc=$(jq -r '.description // ""' "$f")
  printf '%s — %s\n' "$dir" "$desc"
done
```

Présente la liste numérotée en prose (nom + description courte). Attends la réponse de Manu
(numéro ou nom), puis invoque `/lab-ship <projet>`.

### B) Nouveau projet

Invoque `/lab-new` directement — il pose ses propres questions de cadrage (nom, description,
capacités, thème) et déploie jusqu'en prod.

### C) Plomberie

Invoque `/lab-meta` — il demande en prose ce que tu veux modifier dans l'atelier (skills,
CLAUDE.md, scripts, hooks) et avance librement.

**Règle transverse :** jamais de commit sur `main`. Branche → push = preview ; PR mergée = prod.
