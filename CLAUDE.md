# tool-atelier — routeur de l'atelier

Monorepo incubateur des projets de Manu, **pilotable par agents**. **Un dossier = un projet**
(ex. `hello/`, `counter/`), avec son propre `CLAUDE.md` chargé à la volée quand on l'ouvre.

## Au démarrage : qu'est-ce qu'on fait ?

À l'ouverture, lance la skill **`/start`** : elle demande quoi faire (bosser sur un projet /
créer / lister / infra / autre) et oriente. Skills disponibles :

- **`/start`** — routeur d'entrée.
- **`/lab-list`** — liste les projets + leur état (régénère `PROJECTS.md`).
- **`/lab-new`** — crée un projet depuis un starter (`static`/`api`/`flagship`) ou vierge.
- **`/lab-work <projet>`** — focalise la session sur un projet (branche dédiée).
- **`/lab-deploy`** — déploie le projet courant (preview/prod).

`PROJECTS.md` = carte vivante (projets, stack, état, URL). **Régénérée, jamais éditée à la main.**

## Workflow & isolation — RÈGLE ABSOLUE

- **Jamais de commit sur `main`.** On code sur une **branche**, on ouvre une **PR**.
- **Push de branche → preview** : `https://<projet>-<branche>.lab.avqn.ch` (détruite à la suppression de la branche).
- **Merge de PR → prod** : `https://<projet>.lab.avqn.ch`.
- Plusieurs agents en parallèle : chaque session d'arrière-plan a son **worktree isolé** + sa branche → aucun conflit. Un hook `branch-guard` rappelle/bloque les commits sur main (en CLI).

## Déployer (build sur la CI uniquement)

`git push` → GitHub Action build l'image du/des projet(s) modifié(s) → **GHCR** → SSH vers `lab`
→ `scripts/deploy.sh`. Le serveur **ne build jamais** : il *pull* l'image déjà construite. Suivre
avec `gh run watch`. Logs d'un projet : `docker logs <projet>-<env>-app-1` (surface SSH cockpit).

## Données — `lab.json`

Un projet déclare ses besoins dans **`lab.json`** :
`{ "description": "...", "db": true, "redis": false, "email": false, "migrate": "npm run migrate", "seed": "npm run seed" }`
Au déploiement, `deploy.sh` crée la base `<projet>_<env>` (Postgres central), injecte
`DATABASE_URL` (auto), lance `migrate` puis `seed` (hors prod) ; `redis: true` → `REDIS_URL` +
`REDIS_PREFIX` ; `email: true` → `RESEND_API_KEY` + `EMAIL_FROM` (Resend, clé de plateforme).
Preview = base vide + seed, droppée au teardown. Exemples : `hello/` (rien), `counter/` (db).

## Secrets applicatifs (à venir)

Backend de secrets robuste à définir (clés API par projet). Les variables auto-fournies
(`DATABASE_URL`, `REDIS_URL`, `RESEND_API_KEY`) **ne sont pas** à gérer à la main.

## Infra / plateforme

Serveurs, DNS, Postgres/Redis centraux, firewall, secrets de plateforme : pilotés depuis
**cockpit** (repo séparé), pas ici.
