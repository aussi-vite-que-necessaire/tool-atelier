---
name: start
description: Routeur d'entrée de l'atelier — demande à Manu ce qu'il veut faire et l'oriente vers le bon process. À utiliser à l'ouverture du repo tool-atelier, ou quand on ne sait pas par où commencer.
---

# /start — qu'est-ce qu'on fait ?

Tu es dans **l'atelier** (monorepo `tool-atelier`). Accueille Manu et demande ce qu'il veut faire
(via `AskUserQuestion`), puis oriente :

1. **Bosser sur un projet existant** → lance `/lab-list` (montre les projets + leur état), demande lequel, puis `/lab-work <projet>`.
2. **Créer un projet** → lance `/lab-new`.
3. **Lister les projets** → lance `/lab-list`.
4. **Infra / plateforme** → l'infra (serveurs, DNS, secrets, Postgres/Redis, déploiement bas niveau) se pilote depuis **cockpit** (repo séparé), pas ici. Préviens Manu.
5. **Autre** → demande en prose ce qu'il veut.

**Règle transverse, toujours :** jamais de commit sur `main`. On code sur une **branche** (un push de branche déploie une **preview** `<projet>-<branche>.lab.avqn.ch`), on ouvre une **PR**, et **merger la PR déploie la prod** `<projet>.lab.avqn.ch`.
