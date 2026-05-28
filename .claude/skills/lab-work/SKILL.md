---
name: lab-work
description: Se mettre à travailler sur un projet existant de l'atelier — focalise la session et crée une branche dédiée. À utiliser quand Manu veut modifier/faire évoluer un projet précis.
---

# /lab-work <projet> — bosser sur un projet

1. Si le projet n'est pas donné, scanne `*/lab.json` à la racine et demande lequel (nom + description courte).
2. Vérifie que `<projet>/` existe (dossier top-level avec un `Dockerfile`).
3. **Crée une branche dédiée** (jamais sur main) : `git switch -c work/<projet>-<court-libellé>`.
   (En session d'arrière-plan, Claude isole automatiquement le worktree — plusieurs agents ne se marchent pas dessus.)
4. Annonce : « Session focalisée sur **<projet>** (branche `work/...`). Je travaille dans `<projet>/`. »
5. **Travaille uniquement dans `<projet>/`.** Lis son `CLAUDE.md` pour le contexte du projet.
6. Pour mettre en ligne : `/lab-deploy` (push de branche = preview ; PR mergée = prod).

Garde-fou : jamais de commit sur `main` ; la prod passe par une PR.
