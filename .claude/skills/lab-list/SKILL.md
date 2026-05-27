---
name: lab-list
description: Lister les projets de l'atelier et leur état (régénère PROJECTS.md). À utiliser pour voir quels projets existent, leur stack, leur statut de déploiement, ou pour aider à choisir sur quoi bosser.
---

# /lab-list — cartographie des projets

Régénère et affiche la carte vivante des projets.

1. Exécute depuis la racine du repo : `bash scripts/cartography.sh`
   (régénère `PROJECTS.md` à partir du repo + des `/healthz` publics + des PR ouvertes via `gh`).
2. Lis et présente `PROJECTS.md` à Manu (le tableau : projet, description, stack, besoins, URL prod, statut + previews ouvertes).
3. `PROJECTS.md` est un **artefact généré** (gitignoré) : régénéré au démarrage de chaque session (hook) et à chaque `/lab-list`. Ne l'édite **jamais** à la main ; ne le committe pas.

Sert souvent de première étape pour « bosser sur un projet » (voir `/lab-work`).
