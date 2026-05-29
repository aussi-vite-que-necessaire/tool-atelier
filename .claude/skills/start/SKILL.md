---
name: start
description: Entrée de session de l'atelier — demande à Manu ce qu'il veut faire dans cette session et l'oriente vers la bonne skill.
---

# /start — entrée de session

Entrée **principale** de toute session de l'atelier. Une session déjà focalisée sur un projet n'a pas besoin d'y repasser.

Trois rails, trois skills :

| Choix | Skill |
|---|---|
| Travailler sur un projet existant | `/lab-ship <projet>` |
| Créer un nouveau projet | `/lab-new` |
| Plomberie de l'atelier (skills, CLAUDE.md, scripts) | `/lab-meta` |

## Flow

**Étape 1 — Le rail** via `AskUserQuestion` (3 options, ou prose si pas d'UI interactive) :

> Qu'est-ce qu'on fait dans cette session ?
> - Travailler sur un projet existant
> - Créer un nouveau projet
> - Plomberie de l'atelier

**Étape 2 — Selon le rail :**

### A) Projet existant

Scanne les projets pour afficher les noms valides comme repère :

```bash
for f in projects/*/lab.json; do
  dir=$(basename "$(dirname "$f")")
  desc=$(jq -r '.description // ""' "$f")
  printf '%s — %s\n' "$dir" "$desc"
done
```

Affiche la liste (nom + description courte), puis **demande en texte libre, en une seule question** :

> Sur quel projet veux-tu travailler, et qu'est-ce que tu veux y faire ?

Manu répond le projet **et** son brief d'un coup (ex. « media — ajouter l'export PDF des cartes »). Extrais le nom du projet, vérifie qu'il existe dans `projects/`, puis invoque `/lab-ship <projet>`. **Le brief reste dans le fil** : `/lab-cadrer` part de là pour ses clarifying questions au lieu de redemander l'objectif. Ne re-pose pas la question de l'intention.

### B) Nouveau projet

Invoque `/lab-new` directement — il pose ses propres questions de cadrage (nom, description, capacités, thème) et déploie jusqu'en prod.

### C) Plomberie

Invoque `/lab-meta` — il demande en prose ce que tu veux modifier dans l'atelier (skills, CLAUDE.md, scripts, hooks) et avance librement.

**Règle transverse :** jamais de commit sur `main`. Branche → push = preview ; PR mergée = prod.
