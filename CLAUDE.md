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
avec `gh run watch`. Logs d'un projet : `lab-ssh "docker logs <projet>-<env>-app-1"` (skill `/lab-ssh`).

**DNS — à venir.** Le schéma de sous-domaines plat sous `*.lab.avqn.ch` (wildcard) ne demande
**aucun enregistrement DNS par projet**. Une compétence DNS (domaines personnalisés) pourra être
ajoutée plus tard si le besoin se présente.

## Données — `lab.json`

Un projet déclare ses besoins dans **`lab.json`** :
`{ "description": "...", "db": true, "redis": false, "email": false, "browser": false, "migrate": "npm run migrate", "seed": "npm run seed" }`
Au déploiement, `deploy.sh` crée la base `<projet>_<env>` (Postgres central), injecte
`DATABASE_URL` (auto), lance `migrate` puis `seed` (hors prod) ; `redis: true` → `REDIS_URL` +
`REDIS_PREFIX` ; `email: true` → `RESEND_API_KEY` + `EMAIL_FROM` (Resend, clé de plateforme) ;
`browser: true` → `BROWSER_URL` (Chromium partagé browserless, central sur le réseau `lab`).
Preview = base vide + seed, droppée au teardown. Exemples : `hello/` (rien), `counter/` (db).

## Secrets applicatifs — `/lab-secret`

Les clés API et variables sensibles par projet se gèrent avec la skill **`/lab-secret`** :
secrets `age`-chiffrés versionnés dans `secrets/`, déverrouillés par l'unique variable
`LAB_SECRETS_KEY`, par scope (`global` partagé / `sysadmin` opérateur / `<projet>`). Au
déploiement, `deploy.sh` déchiffre et injecte `global` + le scope du projet. Les variables
auto-fournies (`DATABASE_URL`, `REDIS_URL`, `RESEND_API_KEY`) **ne sont pas** à gérer à la main.

## Infra / plateforme

Serveurs, DNS, Postgres/Redis centraux, firewall : l'infra bas niveau est gérée **hors de
l'atelier**, pas ici. L'atelier est autonome pour ses secrets (`/lab-secret`) et son déploiement.
