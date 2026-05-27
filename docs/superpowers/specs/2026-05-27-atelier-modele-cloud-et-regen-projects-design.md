# Atelier — modèle « opérer = une capacité » + régénération de PROJECTS.md

> Spec de design. Date : 2026-05-27.

## Problème

Deux incohérences de plomberie dans l'atelier :

1. **Faux clivage local/cloud.** `CLAUDE.md` (section *Collaboration multi-agents*) pose
   *« Construire = cloud / Opérer = local de confiance »* et affirme qu'on ne met *« ni la clé
   SSH ni `LAB_SECRETS_KEY` »* en cloud. Or les skills `lab-ssh` et `lab-secret` disent
   explicitement *« en Claude cloud, `LAB_SECRETS_KEY` y est déjà »*, et la clé SSH n'est jamais
   « locale » : elle est tirée du store (`sysadmin/LAB_SSH_KEY_B64`), déchiffrée en mémoire par
   `LAB_SECRETS_KEY`, utilisée, effacée. Une session cloud a donc déjà tout pour opérer. Le
   « local de confiance » est une fausse piste qui contredit la réalité et la mémoire
   `remote-first-atelier`.

2. **`PROJECTS.md` pourrit.** Fichier committé, régénérable par `scripts/cartography.sh`
   (déterministe : lit les `Dockerfile`/`lab.json`/`package.json`, ping les `/healthz`, liste les
   PR via `gh`), mais que rien ne relance. Résultat constaté : 5 projets existent (`contentos`,
   `counter`, `hello`, `media`, `ressources`), le fichier committé n'en liste que 2. Il mêle du
   **structurel** (stable, dérivé du repo) et de l'**état vivant** (🟢/🔴, previews — périmé dès
   qu'on committe), sans mécanisme de fraîcheur.

## Modèle cible

### Axe de sécurité — décision

Une seule contrainte dure : **la prod est sérialisée** (elle ne change que par PR → merge → CI,
un déploiement à la fois). Pour tout le reste, **opérer est une capacité, pas un lieu** : toute
session détenant `LAB_SECRETS_KEY` (cloud comme local) est opérateur de plein droit — SSH
lecture/diagnostic, secrets, logs. Le local n'a **aucun privilège** que le cloud n'ait pas.
`LAB_SECRETS_KEY` est une variable d'environnement de l'environnement cloud (visible, assumé).

## Partie A — `CLAUDE.md`

### A1. Section *Collaboration multi-agents* (remplacement intégral des puces)

État cible (pas de cadrage par contraste) :

```markdown
## Collaboration multi-agents

**Étoile polaire : deux agents ne touchent jamais la même ressource mutable au même instant.** Le code et la branche s'isolent par session ; la prod (singleton) se sérialise.

- **Une session = un worktree isolé + une branche.** Ouverte par **`Atelier.command`** ou directement `claude --worktree` (worktree auto-nommé, auto-nettoyé s'il n'a rien produit), en local comme en cloud (`claude.ai/code`). Jamais deux sessions d'écriture dans le checkout principal : il sert de base de lancement et pour la plomberie de l'atelier (CLAUDE.md, skills, scripts), pas pour le dev projet. Le hook `branch-guard` bloque les commits/push sur `main` et le dev projet dans le checkout principal partagé.
- **Construire = en session isolée.** Chaque tâche autonome tourne dans sa session (sa branche, sa preview, sa PR). Le deploy est CI-piloté (`git push`) : aucune session n'a besoin de SSH pour déployer.
- **Opérer = une capacité, pas un lieu.** Toute session qui détient `LAB_SECRETS_KEY` est opérateur de plein droit : SSH lecture/diagnostic (`/lab-ssh`), secrets (`/lab-secret`), logs. La clé SSH du lab n'est pas « locale » — elle est tirée du store (`sysadmin/LAB_SSH_KEY_B64`), déchiffrée en mémoire, utilisée, effacée. Le local n'a aucun privilège que le cloud n'ait pas.
- **Prod sérialisée.** La prod ne change que par l'entonnoir PR → merge → CI (un seul déploiement à la fois). Pas de mutation de prod en SSH ad hoc ; la lecture/diagnostic SSH reste libre depuis n'importe quelle session.
- **Frameworks invités.** superpowers et consorts accélèrent mais défèrent à ce contrat : leurs skills de worktree utilisent le worktree natif (`claude --worktree`), leur « fin de branche » défère à `/lab-deploy` + PR.
- **Amorçage cloud.** Une fois : connecter GitHub (`/web-setup`). L'environnement cloud lance `scripts/cloud-setup.sh` au démarrage (installe les deps par projet). `LAB_SECRETS_KEY` est une variable d'environnement de l'environnement cloud — visible, assumé : c'est elle qui fait d'une session cloud un opérateur de plein droit.
```

Notes :
- La puce *« Une session = un worktree isolé »* absorbe l'ancienne *« Sessions locales isolées »*
  (doublon avec la ligne de la section *Workflow & isolation*).
- On retire *« Construire = cloud »* (lieu) au profit de *« en session isolée »* (mode), et tout
  ce qui interdisait `LAB_SECRETS_KEY`/clé SSH en cloud.

### A2. Ligne « carte vivante » (haut du fichier, l. 21)

Remplacer :

```markdown
`PROJECTS.md` = carte vivante (projets, stack, état, URL). **Régénérée, jamais éditée à la main.**
```

par :

```markdown
`PROJECTS.md` = carte vivante (projets, stack, état, URL). **Artefact généré (gitignoré), jamais édité à la main** : régénéré au démarrage de chaque session et par `/lab-list`.
```

## Partie B — `PROJECTS.md` : artefact généré, frais à chaque session

### B1. Sortir `PROJECTS.md` du suivi git

- `git rm --cached PROJECTS.md` (le retire de l'index, garde le fichier sur disque).
- Ajouter `PROJECTS.md` à `.gitignore`.

### B2. Hook `session-start.sh` — régénération en arrière-plan

Le hook `.claude/hooks/session-start.sh` lance `scripts/cartography.sh` **détaché et non
bloquant**, puis émet son message d'accueil comme aujourd'hui.

- **Pourquoi détaché.** `cartography.sh` ping jusqu'à 5 `/healthz` (`--max-time 6` chacun) + `gh
  pr list` : largement au-delà du `timeout: 5` du hook. Lancer en avant-plan gèlerait le
  démarrage de session.
- **Mécanique.** `nohup bash "$REPO_ROOT/scripts/cartography.sh" >/dev/null 2>&1 &` (le process
  survit au retour du hook). `REPO_ROOT` = racine du dépôt courant (worktree ou checkout
  principal) ; `cartography.sh` écrit déjà dans `$REPO_ROOT/PROJECTS.md`.
- **Best-effort.** L'échec de la régénération (deps manquantes, réseau) ne doit **jamais** casser
  la session : le lancement est détaché et son code de retour ignoré ; le hook continue et émet
  son accueil normalement.
- **Portée.** Régénéré dans **toutes** les sessions (le map sert aussi bien au `/start` local en
  worktree qu'en cloud). Coût négligeable (arrière-plan, fichier gitignoré).

### B3. `/lab-list` reste le rafraîchissement à la demande

`/lab-list` continue de lancer `cartography.sh` (synchrone) puis d'afficher. Texte de la skill
ajusté : `PROJECTS.md` est un artefact généré/gitignoré, régénéré au démarrage de session et par
`/lab-list`. Redondance volontaire avec le hook : `/lab-list` capture les changements survenus en
cours de session.

### B4. En-tête généré par `cartography.sh`

L'en-tête écrit dans `PROJECTS.md` (l. 99 du script) mentionne l'état cible :

```
> Carte vivante régénérée par `scripts/cartography.sh` (hook session-start + skill `/lab-list`). **Artefact généré, gitignoré, jamais édité à la main.**
```

## Fichiers touchés

| Fichier | Changement |
|---|---|
| `CLAUDE.md` | A1 (section Collaboration), A2 (ligne carte vivante) |
| `.gitignore` | + `PROJECTS.md` |
| `PROJECTS.md` | `git rm --cached` (devient artefact local) |
| `.claude/hooks/session-start.sh` | lancement détaché de `cartography.sh` |
| `.claude/skills/lab-list/SKILL.md` | texte « généré/gitignoré, régénéré au session-start » |
| `scripts/cartography.sh` | en-tête généré (B4) |

## Vérification

1. **Régénération réelle.** Supprimer `PROJECTS.md`, simuler le hook (`echo '{}' |
   .claude/hooks/session-start.sh` puis attendre), confirmer que `PROJECTS.md` réapparaît avec les
   **5** projets.
2. **Non bloquant.** Le hook retourne en < 1s (le `&` détache la régénération).
3. **Gitignore effectif.** `git status` ne montre plus `PROJECTS.md` comme suivi ni modifié ;
   `git check-ignore PROJECTS.md` le confirme.
4. **Cohérence doc.** Après réécriture, `CLAUDE.md` ne laisse deviner aucun « local privilégié »
   ni interdiction de `LAB_SECRETS_KEY` en cloud ; relecture croisée avec `lab-ssh`/`lab-secret`.

## Risques

- **Survie du process détaché.** Selon la manière dont le harness gère les enfants du hook, le
  `nohup … &` pourrait être reaped au retour du hook. Mitigation : vérifier point 1 ci-dessus ;
  repli possible vers `setsid`/double-fork si nécessaire.

## Hors scope (YAGNI)

- Pas de split structurel/vivant de `PROJECTS.md` (gitignore + auto-régen suffisent).
- Pas de déclencheur CI au merge (le session-start couvre le besoin de fraîcheur).
- Pas d'« IA d'analyse » : `cartography.sh` est déjà déterministe.
