# Refonte du lanceur de l'atelier — design

## Objectif

Le lanceur de l'atelier (`Atelier.command`) ne sert qu'à **créer un environnement de
travail isolé** (« sandboxer le dev »). Il choisit un seul axe : **local ou cloud**. Il ne
décide d'aucune tâche et ne demande rien d'autre. Tout le « quoi faire » — bosser sur un
projet, en créer un, toucher la plomberie — est décidé **à l'intérieur** de la session par
la skill `/start`, identique en local et en cloud.

## Modèle

```
Atelier.command  ──►  « local ou cloud ? »  (seule question)
     │
     ├─ local  ──►  claude --worktree            ──►  /start (terminal)
     └─ cloud  ──►  claude --remote "<amorçage>"  ──►  /start (claude.ai / mobile)
```

- Le lanceur = **où** tourne le bac à sable. Rien sur **ce qu'on y fait**.
- `/start` = **ce qu'on fait**. C'est l'entrée principale de toute session.

## Le lanceur — `Atelier.command`

Script double-cliquable (macOS) et lançable au terminal. Il est **autonome** (toute sa
logique est dans ce fichier ; il n'appelle aucun script tiers de l'atelier).

Comportement :

1. Se place à la racine de l'atelier (`cd "$(dirname "$0")"`).
2. Pose **une** question : `local` ou `cloud`.
3. Selon la réponse :
   - **local** → `exec claude --worktree`
   - **cloud** → `exec claude --remote "<prompt d'amorçage>"`

Aucune autre question. Pas de nom de projet, pas de libellé, pas de tâche.

### Chemin local

`claude --worktree` (worktree natif de Claude Code) :

- Crée un worktree isolé auto-nommé sous `.claude/worktrees/`, sur une branche
  `worktree-<nom>` basée sur `origin/<branche-par-défaut>` (réglage `worktree.baseRef`
  par défaut = `fresh`).
- **Auto-nettoyé** à la sortie si aucun changement ; sinon Claude demande quoi en faire.
- La session démarre dans le worktree ; le hook `session-start` l'oriente vers `/start`.

Le nom de branche auto (`worktree-<nom>`) sert tel quel à la preview au push
(`<projet>-worktree-<nom>.lab.avqn.ch`) ; jamais renommé. Les previews sont éphémères.

### Chemin cloud

`claude --remote "<prompt d'amorçage>"` :

- `--remote` exige un argument de prompt non vide. On y passe un **amorçage fixe** qui ne
  fait que déclencher le menu, **sans décider de tâche** :
  > « Lance la skill /start : demande-moi ce que je veux faire dans cette session et
  > oriente-moi vers la bonne skill. Ne choisis aucune tâche toi-même, attends ma réponse. »
- La session est créée sur claude.ai, sur sa propre branche, et est **interactive** : on la
  pilote depuis **claude.ai/code** ou l'app mobile (le terminal local dépêche puis rend la
  main).
- **Détection de support** : `--remote` n'est pas présent dans toutes les versions du CLI.
  Le lanceur teste sa présence (`claude --help`) ; s'il est absent, il **n'essaie pas** et
  ouvre `claude.ai/code` (entrée cloud du web) avec un message clair — pas d'échec silencieux.
- Prérequis (déjà documentés) : connexion GitHub (`/web-setup`), compte claude.ai,
  abonnement. La CI/`scripts/cloud-setup.sh` installe les deps au démarrage.

## Dedans — `/start`, routeur principal

`/start` est l'**entrée principale** de toute session de l'atelier (local comme cloud),
pas un secours. Au démarrage, le hook `session-start` invite à le lancer.

`/start` demande à Manu ce qu'il veut faire (via `AskUserQuestion`, avec **repli en prose**
si l'UI de question ne s'affiche pas — utile en cloud, où le rendu n'est pas formellement
garanti), puis oriente :

1. **Bosser sur un projet existant** → `/lab-work <projet>` (après `/lab-list` si besoin).
2. **Créer un projet** → `/lab-new`.
3. **Plomberie de l'atelier** (CLAUDE.md, skills, `Atelier.command`, hooks, scripts) →
   travail mené dans la session worktree courante.
4. **Lister les projets** → `/lab-list`.
5. **Infra / plateforme** (serveurs, DNS, Postgres/Redis centraux) → gérée hors atelier ;
   secrets applicatifs via `/lab-secret`.
6. **Autre** → demande en prose.

Règle transverse rappelée : jamais de commit sur `main` ; push de branche = preview,
PR mergée = prod.

## Garde-fous

### `session-start.sh`

Accueil selon le scope, sans deviner le projet depuis le nom de branche :

- **Worktree lié** (`GIT_DIR != GIT_COMMON`, hors sous-module) → « Session isolée
  (branche `<branche>`). Lance `/start` pour décider quoi faire. Jamais de commit sur main ;
  push = preview, PR mergée = prod. »
- **Checkout principal** → « Checkout principal de l'atelier. Pour bosser, lance
  `Atelier.command` (local ou cloud). Le garde-fou interdit le dev projet ici. »

### `branch-guard.sh`

Logique de fond **inchangée** (elle distingue worktree-lié vs checkout principal par le
git-dir, pas par le nom de branche) :

1. Jamais de commit/push quand la branche est `main`/`master` (tout checkout).
2. Dans le checkout principal partagé : refus de `git switch`/`checkout <branche>` et refus
   d'éditer un dossier projet (top-level avec `Dockerfile`).
3. Worktree lié → tout permis.

Seuls les **messages** sont réécrits : remplacer les mentions `lab new <projet> <libellé>`
par « lance une session via `Atelier.command` (ou `claude --worktree`) ».

## Suppressions

- `bin/lab` — toute la plomberie de worktree (`menu`, `new`, `create`, `meta`, `ls`, `cd`,
  `rm`, `sync_main`) est remplacée par le worktree natif de Claude Code.
- `bin/lab-shell.sh` — la fonction shell `lab` (cd-into-worktree) n'a plus d'objet.

La gestion des worktrees restants (lister, retirer) se fait au besoin avec git natif
(`git worktree list` / `git worktree remove`) ou les outils de session (`ExitWorktree`).

## Docs et skills à réécrire

Décrire l'état cible (instantané, pas d'historique) :

- **`CLAUDE.md`** — sections « Au démarrage », « Workflow & isolation », « Collaboration
  multi-agents » : le lanceur = sandbox local/cloud ; `/start` décide tout ; plus de `lab`.
- **`.claude/skills/start/SKILL.md`** — `/start` devient l'entrée principale (retirer le
  cadrage « routeur de secours »), ajouter le repli prose pour le cloud.
- **Skills `lab-*`** (`lab-work`, `lab-new`, `lab-list`, `lab-deploy`, `lab-ssh`,
  `lab-secret`) — retirer les références à `lab new/meta/menu/cd/rm` ; pointer vers le
  nouveau geste (`Atelier.command` / `claude --worktree`).
- **`README.md`** et **`docs/multi-agents-design.md`** — aligner sur le modèle natif
  (`claude --worktree` / `claude --remote`), retirer la « surface » `bin/lab`.

## Hors scope

- Modifier l'infra bas niveau (serveurs, DNS, Postgres/Redis centraux) : hors atelier.
- Changer le schéma de nommage des branches/previews (branche auto, jamais renommée — acté).
- Rendre le rendu interactif de `/start` en cloud « garanti » : on couvre le risque par le
  repli prose, on ne cherche pas à le certifier ici.

## Risques / incertitudes

- **Disponibilité de `--remote`** : absent du CLI installé (vérifié sur 2.1.152, qui n'a que
  `--remote-control`). Le lanceur détecte et retombe sur `claude.ai/code` — le mode cloud du
  lanceur ne devient « direct » que sur une version du CLI qui expose `--remote`.
- **Rendu interactif en cloud** : `claude --remote "/start..."` est attendu fonctionnel
  (les sessions cloud sont interactives), mais le rendu d'`AskUserQuestion` en cloud n'est
  pas formellement vérifié. Mitigation : `/start` retombe sur une question en prose.
- **Fraîcheur de la base du worktree** : `claude --worktree` branche sur
  `origin/<défaut>` (`baseRef: fresh`) ; suppose un `origin` joignable et à jour. Acceptable
  pour un bac à sable ; pas de `sync_main` maison à réintroduire.
```

