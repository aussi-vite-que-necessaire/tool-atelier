# tool-atelier — routeur de l'atelier

Monorepo incubateur des projets de Manu, **pilotable par agents**. **Un dossier = un projet**
(ex. `hello/`, `counter/`), avec son propre `CLAUDE.md` chargé à la volée quand on l'ouvre.

Le projet **`skills/`** est le **hub central des skills agentiques** de la suite de tools
(`contentos`, `ressources`, `media`) : il est la **source de vérité** des skills (un dossier
par skill, avec `manifest.json` + `SKILL.md`), expose une page publique listant les skills
disponibles, et sert chaque skill en zip versionné (`<skill>-v<n>.zip`) après login OTP.
Prod : `https://skills.lab.avqn.ch`.

## Au démarrage : qu'est-ce qu'on fait ?

L'entrée de l'atelier est le lanceur **`Atelier.command`** (double-clic macOS, ou exécuté au
terminal). Il ne fait qu'une chose : **sandboxer le dev**. Il ouvre une session isolée sur ta
machine — worktree natif de Claude Code (`claude --worktree`) — et y lance **`/start`**.

Le lanceur ne décide d'aucune tâche : **ce qu'on fait dans la session, c'est `/start` qui le
décide**, à l'intérieur. Skills disponibles :

- **`/start`** — entrée de session : demande quoi faire et oriente.
- **`/lab-ship`** — flow autonome de feature-work : questions de cadrage, puis spec → plan → implémentation (sub-agents) → PR prévisualisable, sans validation intermédiaire. Orchestre `/lab-new` ou `/lab-work` selon le cas.
- **`/lab-list`** — liste les projets + leur état (régénère `PROJECTS.md`).
- **`/lab-new`** — crée un projet en composant une base Next.js + des capacités (`db`/`redis`/`auth`/`mcp`), avec thème écrit par l'IA, et le déploie jusqu'en prod.
- **`/lab-work <projet>`** — focalise la session sur un projet (branche dédiée).
- **`/lab-deploy`** — déploie le projet courant (preview/prod).

Le feature-work passe par **`/lab-ship`** (autonome de bout en bout) ; son seul point d'arrêt humain est la vague de questions de cadrage.

`PROJECTS.md` = carte vivante (projets, stack, état, URL). **Artefact généré (gitignoré), jamais édité à la main** : régénéré au démarrage de chaque session et par `/lab-list`.

## Workflow & isolation — RÈGLE ABSOLUE

- **Jamais de commit sur `main`.** On code sur une **branche**, on ouvre une **PR**.
- **Push de branche → preview** : `https://<projet>-<branche>.lab.avqn.ch` (détruite à la suppression de la branche).
- **Merge de PR → prod** : `https://<projet>.lab.avqn.ch`.
- **Merger** : `gh pr merge <#> --squash`. La branche distante se supprime seule (le dépôt a `delete_branch_on_merge`). Côté local, on retire le worktree : `git worktree remove <chemin>` puis `git branch -D <branche>`. Le drapeau `--delete-branch` est inutile et échoue en contexte worktree (gh tente de basculer le checkout sur `main`, déjà occupé).
- **Une session = un worktree isolé + une branche.** Le lanceur s'appuie sur le worktree natif de Claude Code (`claude --worktree`) ; voir « Collaboration multi-agents ». Le hook `branch-guard` bloque les commits sur `main` et les push qui mettraient `main` à jour (la suppression d'une branche distante reste permise), ainsi que le dev projet dans le checkout principal partagé.

## Collaboration multi-agents

**Étoile polaire : deux agents ne touchent jamais la même ressource mutable au même instant.** Le code et la branche s'isolent par session ; la prod (singleton) se sérialise.

- **Une session = un worktree isolé + une branche.** Ouverte par **`Atelier.command`** ou directement `claude --worktree` (worktree auto-nommé, auto-nettoyé s'il n'a rien produit), en local comme en cloud (`claude.ai/code`). Jamais deux sessions d'écriture dans le checkout principal : il sert de base de lancement et pour la plomberie de l'atelier (CLAUDE.md, skills, scripts), pas pour le dev projet. Le hook `branch-guard` bloque les commits/push sur `main` et le dev projet dans le checkout principal partagé.
- **Construire = en session isolée.** Chaque tâche autonome tourne dans sa session (sa branche, sa preview, sa PR). Le deploy est CI-piloté (`git push`) : aucune session n'a besoin de SSH pour déployer.
- **Opérer = une capacité, pas un lieu.** Toute session qui détient `LAB_SECRETS_KEY` est opérateur de plein droit : SSH lecture/diagnostic (`/lab-ssh`), secrets (`/lab-secret`), logs. La clé SSH du lab n'est pas « locale » — elle est tirée du store (`sysadmin/LAB_SSH_KEY_B64`), déchiffrée en mémoire, utilisée, effacée. Le local n'a aucun privilège que le cloud n'ait pas.
- **Prod sérialisée.** La prod ne change que par l'entonnoir PR → merge → CI (un seul déploiement à la fois). Pas de mutation de prod en SSH ad hoc ; la lecture/diagnostic SSH reste libre depuis n'importe quelle session.
- **Frameworks invités.** superpowers et consorts accélèrent mais défèrent à ce contrat : leurs skills de worktree utilisent le worktree natif (`claude --worktree`), leur « fin de branche » défère à `/lab-deploy` + PR.
- **Amorçage cloud.** Une fois : connecter GitHub (`/web-setup`). L'environnement cloud lance `scripts/cloud-setup.sh` au démarrage (installe les deps par projet). `LAB_SECRETS_KEY` est une variable d'environnement de l'environnement cloud — visible, assumé : c'est elle qui fait d'une session cloud un opérateur de plein droit.

## Déployer (build sur la CI uniquement)

`git push` → GitHub Action build l'image du/des projet(s) modifié(s) → **GHCR** → SSH vers `lab`
→ `scripts/deploy.sh`. Le serveur **ne build jamais** : il *pull* l'image déjà construite. Suivre
avec `gh run watch`. Logs d'un projet : `lab-ssh "docker logs <projet>-<env>-app-1"` (skill `/lab-ssh`).

**DNS — à venir.** Le schéma de sous-domaines plat sous `*.lab.avqn.ch` (wildcard) ne demande
**aucun enregistrement DNS par projet**. Une compétence DNS (domaines personnalisés) pourra être
ajoutée plus tard si le besoin se présente.

## Données — `lab.json`

Un projet déclare ses besoins dans **`lab.json`** :
`{ "description": "...", "db": true, "redis": false, "email": false, "browser": false, "domain": "monprojet.com", "migrate": "npm run migrate", "seed": "npm run seed" }`
Au déploiement, `deploy.sh` crée la base `<projet>_<env>` (Postgres central), injecte
`DATABASE_URL` (auto), lance `migrate` puis `seed` (hors prod) ; `redis: true` → `REDIS_URL` +
`REDIS_PREFIX` ; `email: true` → `RESEND_API_KEY` + `EMAIL_FROM` (Resend, clé de plateforme) ;
`browser: true` → `BROWSER_URL` (Chromium partagé browserless, central sur le réseau `lab`).
Quel que soit `lab.json`, `deploy.sh` injecte aussi **`APP_URL`** = l'origine publique du
déploiement. Par défaut c'est le host attribué par la plateforme
(`https://<projet>-<env>.lab.avqn.ch` en preview, `https://<projet>.lab.avqn.ch` en prod lab).
Si `lab.json` déclare **`domain`**, la **prod** prend ce domaine public custom comme `APP_URL`
(le DNS du domaine doit pointer vers le lab) ; les previews gardent leur host `*.lab.avqn.ch`.
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
