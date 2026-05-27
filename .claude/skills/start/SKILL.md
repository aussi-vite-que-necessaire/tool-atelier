---
name: start
description: Entrée de session de l'atelier — demande à Manu ce qu'il veut faire dans cette session et l'oriente vers la bonne skill. Le lanceur Atelier.command la déclenche automatiquement à l'ouverture d'une session locale ; en session cloud (web), lance-la toi-même.
---

# /start — entrée de session

Entrée **principale** de toute session de l'atelier. Le lanceur `Atelier.command` ouvre une
session isolée locale et déclenche cette skill ; en session cloud (web), on la lance soi-même.
C'est ici qu'on décide quoi faire. Une session déjà focalisée sur un projet n'a pas besoin d'y
repasser.

Demande à Manu ce qu'il veut faire, puis oriente :

1. **Lancer une tâche (feature-work)** — nouveau projet, évolution d'un projet, ou plomberie de l'atelier → **`/lab-ship`**. Décris l'idée ; il pose la vague de questions de cadrage, puis enchaîne spec → plan → implémentation (sub-agents) → PR prévisualisable **en autonomie**, sans autre validation. `/lab-ship` met en place l'isolation et appelle `/lab-new` (nouveau) ou `/lab-work` (existant) selon le cas.
2. **Lister les projets** → `/lab-list`.
3. **Infra / plateforme** → gérée **hors de l'atelier** ; les secrets applicatifs via `/lab-secret`.
4. **Autre** → demande en prose.

Pose la question via `AskUserQuestion`. **En session cloud** (où l'UI de question peut ne pas
s'afficher), si l'outil n'est pas disponible, pose la même question **en prose** et attends la
réponse.

**Règle transverse :** jamais de commit sur `main`. Branche → push = preview ; PR mergée = prod.
