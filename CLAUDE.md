# tool-atelier — routeur de l'atelier

Monorepo incubateur des projets de Manu, **pilotable par agents**. **Un dossier = un projet**
(ex. `hello/`, `counter/`), avec son propre `CLAUDE.md` chargé à la volée quand on l'ouvre.

## Au démarrage : qu'est-ce qu'on fait ?

L'entrée de l'atelier est le launcher **`lab`** (ou double-clic **`Atelier.command`**) : il
demande quoi faire et prépare le bon contexte (worktree isolé) avant de lancer `claude`. Si tu
ouvres `claude` brut dans le checkout principal, lance **`/start`** (routeur de secours). Skills disponibles :

- **`/start`** — routeur de secours (dans claude).
- **`/lab-list`** — liste les projets + leur état (régénère `PROJECTS.md`).
- **`/lab-new`** — crée un projet depuis un starter (`static`/`api`/`flagship`) ou vierge.
- **`/lab-work <projet>`** — focalise la session sur un projet (branche dédiée).
- **`/lab-deploy`** — déploie le projet courant (preview/prod).

`PROJECTS.md` = carte vivante (projets, stack, état, URL). **Régénérée, jamais éditée à la main.**

## Workflow & isolation — RÈGLE ABSOLUE

- **Jamais de commit sur `main`.** On code sur une **branche**, on ouvre une **PR**.
- **Push de branche → preview** : `https://<projet>-<branche>.lab.avqn.ch` (détruite à la suppression de la branche).
- **Merge de PR → prod** : `https://<projet>.lab.avqn.ch`.
- **Une session = un worktree isolé + une branche.** Voir « Collaboration multi-agents ». Le hook `branch-guard` bloque les commits/push sur `main` et le dev projet dans le checkout principal partagé.

## Collaboration multi-agents

**Étoile polaire : deux agents ne touchent jamais la même ressource mutable au même instant.** Le code et la branche s'isolent ; la prod (singleton) se sérialise.

- **Construire = cloud.** Chaque tâche autonome tourne en session cloud (isolée, sa branche, sa preview, sa PR). Le deploy est CI-piloté (`git push`), donc une session cloud n'a pas besoin de SSH. On n'y met ni la clé SSH du lab ni `LAB_SECRETS_KEY`.
- **Opérer = local de confiance.** Logs, diagnostic (`/lab-ssh`), secrets (`/lab-secret`), dev hands-on : sur ta machine, qui détient les clés.
- **Sessions locales isolées.** Une session = un worktree sous `.claude/worktrees/` + sa branche `work/<projet>-<libellé>`. Lance-les avec **`lab new <projet> <libellé>`** (ou le menu double-clic `Atelier.command`). Jamais deux sessions d'écriture dans le checkout principal : il sert de base de lancement et pour la plomberie de l'atelier (CLAUDE.md, skills, scripts), pas pour le dev projet.
- **Prod sérialisée.** La prod ne change que par l'entonnoir PR → merge → CI (un seul déploiement à la fois). Pas de mutation de prod en SSH ad-hoc ; la lecture/diagnostic SSH reste libre.
- **Frameworks invités.** superpowers et consorts accélèrent mais défèrent à ce contrat : leurs skills de worktree utilisent `lab`, leur « fin de branche » défère à `/lab-deploy` + PR.
- **Amorçage cloud.** Une fois : connecter GitHub (`/web-setup`). L'environnement cloud lance `scripts/cloud-setup.sh` au démarrage (installe les deps par projet). Les secrets cloud sont des variables d'environnement (visibles) : on n'y met que ce qu'une session de build doit voir.

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
Quel que soit `lab.json`, `deploy.sh` injecte aussi **`APP_URL`** = l'origine publique du
déploiement (`https://<projet>-<env>.lab.avqn.ch` en preview, `https://<projet>.lab.avqn.ch` en
prod lab) : la plateforme attribue le host, c'est donc elle qui fournit l'URL.
Preview = base vide + seed, droppée au teardown. Exemples : `hello/` (rien), `counter/` (db).

## Secrets applicatifs — `/lab-secret`

Les clés API et variables sensibles par projet se gèrent avec la skill **`/lab-secret`** :
secrets `age`-chiffrés versionnés dans `secrets/`, déverrouillés par l'unique variable
`LAB_SECRETS_KEY`, par scope (`global` partagé / `sysadmin` opérateur / `<projet>`). Au
déploiement, `deploy.sh` déchiffre et injecte `global` + le scope du projet. Les variables
auto-fournies (`APP_URL`, `DATABASE_URL`, `REDIS_URL`, `RESEND_API_KEY`) **ne sont pas** à gérer à
la main.

## Infra / plateforme

Serveurs, DNS, Postgres/Redis centraux, firewall : l'infra bas niveau est gérée **hors de
l'atelier**, pas ici. L'atelier est autonome pour ses secrets (`/lab-secret`) et son déploiement.
