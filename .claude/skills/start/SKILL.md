---
name: start
description: Entrée de session de l'atelier — demande à Manu ce qu'il veut faire dans cette session et l'oriente vers la bonne skill. À lancer au début de toute session ouverte via Atelier.command (local ou cloud).
---

# /start — entrée de session

Entrée **principale** de toute session de l'atelier. Le lanceur `Atelier.command` ne fait que
sandboxer (local ou cloud) ; c'est ici qu'on décide quoi faire. Une session déjà focalisée sur
un projet n'a pas besoin d'y repasser.

Demande à Manu ce qu'il veut faire, puis oriente :

1. **Bosser sur un projet existant** → `/lab-list`, demande lequel, puis `/lab-work <projet>`.
2. **Créer un projet** → `/lab-new`.
3. **Plomberie de l'atelier** (CLAUDE.md, skills, hooks, scripts, `Atelier.command`) → tu es
   déjà dans une session worktree isolée, travaille directement ici.
4. **Lister les projets** → `/lab-list`.
5. **Infra / plateforme** → gérée **hors de l'atelier** ; les secrets applicatifs, eux, via `/lab-secret`.
6. **Autre** → demande en prose.

Pose la question via `AskUserQuestion`. **En session cloud** (où l'UI de question peut ne pas
s'afficher), si l'outil n'est pas disponible, pose la même question **en prose** et attends la
réponse.

**Règle transverse :** jamais de commit sur `main`. Branche → push = preview ; PR mergée = prod.
