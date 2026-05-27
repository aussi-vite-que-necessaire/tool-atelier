# Atelier — modèle « opérer = une capacité » + régénération PROJECTS.md — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Réconcilier `CLAUDE.md` avec la réalité (opérer = capacité de toute session détenant `LAB_SECRETS_KEY`, prod seule sérialisée) et faire de `PROJECTS.md` un artefact généré/gitignoré régénéré à chaque démarrage de session.

**Architecture:** Changements de plomberie : un hook `SessionStart` lance `scripts/cartography.sh` détaché (non bloquant) ; `PROJECTS.md` sort du suivi git ; quatre fichiers de doc/skill/script alignés sur l'état cible. Aucun code applicatif, pas de framework de test : la « vérification » de chaque tâche est une commande shell dont on contrôle la sortie.

**Tech Stack:** Bash (hooks, `cartography.sh`), git, Markdown.

Spec de référence : `docs/superpowers/specs/2026-05-27-atelier-modele-cloud-et-regen-projects-design.md`.

---

## File Structure

| Fichier | Responsabilité | Action |
|---|---|---|
| `.gitignore` | Exclut les artefacts générés | Modifier (+ `PROJECTS.md`) |
| `PROJECTS.md` | Carte des projets (artefact local) | `git rm --cached` |
| `.claude/hooks/session-start.sh` | Accueil de session + régen de la carte | Modifier |
| `scripts/cartography.sh` | Génère `PROJECTS.md` | Modifier (en-tête) |
| `.claude/skills/lab-list/SKILL.md` | Skill de cartographie à la demande | Modifier (texte) |
| `CLAUDE.md` | Doctrine de l'atelier | Modifier (2 blocs) |

---

## Task 1 : Sortir `PROJECTS.md` du suivi git

**Files:**
- Modify: `.gitignore`
- Untrack: `PROJECTS.md`

- [ ] **Step 1 : Retirer `PROJECTS.md` de l'index (garde le fichier sur disque)**

```bash
git rm --cached PROJECTS.md
```

Expected : `rm 'PROJECTS.md'` ; le fichier existe toujours (`ls PROJECTS.md` OK).

- [ ] **Step 2 : Ajouter `PROJECTS.md` au `.gitignore`**

Le `.gitignore` courant contient :

```
.env
.DS_Store
node_modules/
.claude/worktrees/
.superpowers/
```

Ajouter la ligne `PROJECTS.md` à la fin :

```
.env
.DS_Store
node_modules/
.claude/worktrees/
.superpowers/
PROJECTS.md
```

- [ ] **Step 3 : Vérifier que l'ignore est effectif**

```bash
git check-ignore PROJECTS.md && git status --porcelain PROJECTS.md
```

Expected : `git check-ignore` imprime `PROJECTS.md` ; `git status --porcelain PROJECTS.md` n'imprime que la suppression indexée (`D  PROJECTS.md`), plus aucune trace de modif/suivi du fichier de travail.

- [ ] **Step 4 : Commit**

```bash
git add .gitignore
git commit -m "🙈 PROJECTS.md devient un artefact généré (gitignoré)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 2 : Hook `session-start.sh` régénère `PROJECTS.md` en arrière-plan

**Files:**
- Modify: `.claude/hooks/session-start.sh`

- [ ] **Step 1 : Réécrire le hook au complet**

Remplacer tout le contenu de `.claude/hooks/session-start.sh` par :

```bash
#!/usr/bin/env bash
# Hook SessionStart : accueil adapté au scope de la session + régénération de la carte projets.
#   - worktree lié → session isolée : oriente vers /start (qui décide quoi faire).
#   - checkout principal → oriente vers le lanceur Atelier.command (local ou cloud).
#   - dans tous les cas : régénère PROJECTS.md en arrière-plan (artefact gitignoré).
set -uo pipefail

emit() {
  jq -nc --arg c "$1" '{hookSpecificOutput:{hookEventName:"SessionStart",additionalContext:$c}}' 2>/dev/null \
    || printf '%s\n' "$1"
}

git rev-parse --git-dir >/dev/null 2>&1 || { emit "🛠️ Atelier (hors dépôt git)."; exit 0; }
gd="$(git rev-parse --absolute-git-dir 2>/dev/null)"
gcd="$(cd "$(git rev-parse --git-common-dir 2>/dev/null)" 2>/dev/null && pwd -P)"
super="$(git rev-parse --show-superproject-working-tree 2>/dev/null)"
branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '')"
root="$(git rev-parse --show-toplevel 2>/dev/null || echo '')"

# Régénère la carte des projets en arrière-plan. Détaché (sous-shell qui se ferme → process
# orphelin qui survit au hook), best-effort : ne bloque jamais le démarrage et un échec
# (deps/réseau) est silencieux. Frais pour le /start qui suit.
if [ -n "$root" ] && [ -f "$root/scripts/cartography.sh" ]; then
  ( nohup bash "$root/scripts/cartography.sh" >/dev/null 2>&1 & )
fi

# Worktree lié = git-dir distinct du git-dir commun, et pas un sous-module.
if [ -n "$gd" ] && [ "$gd" != "$gcd" ] && [ -z "$super" ]; then
  emit "🛠️ Session isolée (branche \`$branch\`). Lance \`/start\` pour décider quoi faire. Jamais de commit sur main ; push de branche = preview, PR mergée = prod."
else
  emit "🛠️ Atelier — **checkout principal**. Pour bosser, lance le lanceur **\`Atelier.command\`** (local ou cloud) ; il ne fait que sandboxer, tout le reste se décide dans \`/start\`. Le garde-fou interdit le dev projet ici."
fi
exit 0
```

- [ ] **Step 2 : Vérifier que `cartography.sh` produit bien les 5 projets (régen synchrone de contrôle)**

```bash
bash scripts/cartography.sh && grep -c '| `' PROJECTS.md
```

Expected : `PROJECTS.md régénéré → …` puis un compte de lignes-projets ≥ 5 (les lignes du tableau `| \`contentos\` | …`, `counter`, `hello`, `media`, `ressources`). Confirmer la présence des 5 noms :

```bash
for p in contentos counter hello media ressources; do grep -q "\`$p\`" PROJECTS.md && echo "ok $p" || echo "MANQUE $p"; done
```

Expected : `ok` pour les 5.

- [ ] **Step 3 : Vérifier que le hook retourne vite et ne bloque pas**

```bash
rm -f PROJECTS.md
time (echo '{"hook_event_name":"SessionStart","cwd":"'"$PWD"'"}' | .claude/hooks/session-start.sh)
```

Expected : le hook imprime un JSON `hookSpecificOutput…` et **retourne en < 1s** (le `real` du `time` est largement sous le timeout de 5s), alors même que `PROJECTS.md` n'est pas encore réécrit (la régen tourne détachée).

- [ ] **Step 4 : Vérifier que la régen détachée aboutit (survie au hook)**

Attendre que le process d'arrière-plan finisse ses pings réseau, puis contrôler la réapparition du fichier :

```bash
for i in $(seq 1 30); do [ -f PROJECTS.md ] && break; sleep 1; done; ls -l PROJECTS.md && grep -c '| `' PROJECTS.md
```

Expected : `PROJECTS.md` réapparaît (≤ ~30s) avec ses ≥ 5 lignes-projets. **Si le fichier ne réapparaît jamais** → le harness a reapé le process détaché : basculer le lancement (Step 1) sur un double-fork robuste —
`bash -c 'nohup bash "'"$root"'/scripts/cartography.sh" >/dev/null 2>&1 &' &` — ou `setsid bash "$root/scripts/cartography.sh"` si `setsid` est disponible, puis re-vérifier ce step.

- [ ] **Step 5 : Commit**

```bash
git add .claude/hooks/session-start.sh
git commit -m "🪝 session-start: régénère PROJECTS.md en arrière-plan

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 3 : En-tête généré par `cartography.sh`

**Files:**
- Modify: `scripts/cartography.sh:99`

- [ ] **Step 1 : Mettre à jour la ligne d'en-tête**

Dans le bloc `cat > "$OUTPUT" <<MARKDOWN` (vers la ligne 99), remplacer :

```
> Carte vivante régénérée par \`scripts/cartography.sh\` (skill \`/lab-list\`). **Ne pas éditer à la main.**
```

par :

```
> Carte vivante régénérée par \`scripts/cartography.sh\` (hook session-start + skill \`/lab-list\`). **Artefact généré, gitignoré, jamais édité à la main.**
```

(Garder l'échappement `\`` des backticks : on est dans un here-doc non quoté.)

- [ ] **Step 2 : Régénérer et vérifier l'en-tête**

```bash
bash scripts/cartography.sh && sed -n '3p' PROJECTS.md
```

Expected : la ligne 3 affiche `> Carte vivante régénérée par \`scripts/cartography.sh\` (hook session-start + skill \`/lab-list\`). **Artefact généré, gitignoré, jamais édité à la main.**` (backticks rendus, sans antislash).

- [ ] **Step 3 : Commit**

```bash
git add scripts/cartography.sh
git commit -m "🗺️ cartography: en-tête = artefact généré/gitignoré

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 4 : Texte de la skill `/lab-list`

**Files:**
- Modify: `.claude/skills/lab-list/SKILL.md:13`

- [ ] **Step 1 : Réécrire le point 3 de la procédure**

Remplacer la ligne :

```
3. `PROJECTS.md` est **régénérable** : ne l'édite **jamais** à la main. Si tu veux le commiter à jour, fais-le sur une branche (jamais main).
```

par :

```
3. `PROJECTS.md` est un **artefact généré** (gitignoré) : régénéré au démarrage de chaque session (hook) et à chaque `/lab-list`. Ne l'édite **jamais** à la main ; ne le committe pas.
```

- [ ] **Step 2 : Vérifier**

```bash
grep -n "artefact généré" .claude/skills/lab-list/SKILL.md
```

Expected : une ligne correspondante au point 3.

- [ ] **Step 3 : Commit**

```bash
git add .claude/skills/lab-list/SKILL.md
git commit -m "📋 lab-list: PROJECTS.md = artefact généré/gitignoré

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 5 : `CLAUDE.md` — « opérer = une capacité » + ligne carte vivante

**Files:**
- Modify: `CLAUDE.md:21` (ligne carte vivante)
- Modify: `CLAUDE.md:30-39` (section Collaboration multi-agents)

- [ ] **Step 1 : Réécrire la ligne « carte vivante » (l. 21)**

Remplacer :

```
`PROJECTS.md` = carte vivante (projets, stack, état, URL). **Régénérée, jamais éditée à la main.**
```

par :

```
`PROJECTS.md` = carte vivante (projets, stack, état, URL). **Artefact généré (gitignoré), jamais édité à la main** : régénéré au démarrage de chaque session et par `/lab-list`.
```

- [ ] **Step 2 : Réécrire les puces de la section *Collaboration multi-agents***

Remplacer le bloc courant (l. 32-39, de « **Étoile polaire…** » jusqu'à la fin de la puce « **Amorçage cloud.** ») par :

```markdown
**Étoile polaire : deux agents ne touchent jamais la même ressource mutable au même instant.** Le code et la branche s'isolent par session ; la prod (singleton) se sérialise.

- **Une session = un worktree isolé + une branche.** Ouverte par **`Atelier.command`** ou directement `claude --worktree` (worktree auto-nommé, auto-nettoyé s'il n'a rien produit), en local comme en cloud (`claude.ai/code`). Jamais deux sessions d'écriture dans le checkout principal : il sert de base de lancement et pour la plomberie de l'atelier (CLAUDE.md, skills, scripts), pas pour le dev projet. Le hook `branch-guard` bloque les commits/push sur `main` et le dev projet dans le checkout principal partagé.
- **Construire = en session isolée.** Chaque tâche autonome tourne dans sa session (sa branche, sa preview, sa PR). Le deploy est CI-piloté (`git push`) : aucune session n'a besoin de SSH pour déployer.
- **Opérer = une capacité, pas un lieu.** Toute session qui détient `LAB_SECRETS_KEY` est opérateur de plein droit : SSH lecture/diagnostic (`/lab-ssh`), secrets (`/lab-secret`), logs. La clé SSH du lab n'est pas « locale » — elle est tirée du store (`sysadmin/LAB_SSH_KEY_B64`), déchiffrée en mémoire, utilisée, effacée. Le local n'a aucun privilège que le cloud n'ait pas.
- **Prod sérialisée.** La prod ne change que par l'entonnoir PR → merge → CI (un seul déploiement à la fois). Pas de mutation de prod en SSH ad hoc ; la lecture/diagnostic SSH reste libre depuis n'importe quelle session.
- **Frameworks invités.** superpowers et consorts accélèrent mais défèrent à ce contrat : leurs skills de worktree utilisent le worktree natif (`claude --worktree`), leur « fin de branche » défère à `/lab-deploy` + PR.
- **Amorçage cloud.** Une fois : connecter GitHub (`/web-setup`). L'environnement cloud lance `scripts/cloud-setup.sh` au démarrage (installe les deps par projet). `LAB_SECRETS_KEY` est une variable d'environnement de l'environnement cloud — visible, assumé : c'est elle qui fait d'une session cloud un opérateur de plein droit.
```

- [ ] **Step 3 : Vérifier l'absence de l'ancien clivage et la cohérence**

```bash
grep -nE "Opérer = local|Construire = cloud|ni la clé SSH|ne met ni" CLAUDE.md || echo "ancien clivage absent : OK"
grep -n "Opérer = une capacité" CLAUDE.md
grep -n "Artefact généré" CLAUDE.md
```

Expected : `ancien clivage absent : OK` ; les deux `grep` suivants renvoient chacun leur ligne. Relire à l'œil que le texte ne laisse deviner aucun état antérieur (pas de « désormais », « au lieu de »).

- [ ] **Step 4 : Commit**

```bash
git add CLAUDE.md
git commit -m "📜 CLAUDE.md: opérer = une capacité (pas un lieu) ; PROJECTS.md généré

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage :**
- Modèle cible « opérer = capacité » → Task 5 (A1). ✓
- `LAB_SECRETS_KEY` en cloud assumé → Task 5 puce *Amorçage cloud*. ✓
- A2 ligne carte vivante → Task 5 Step 1. ✓
- B1 gitignore → Task 1. ✓
- B2 hook background → Task 2. ✓
- B3 lab-list texte → Task 4. ✓
- B4 en-tête cartography → Task 3. ✓
- Risque survie process détaché → Task 2 Step 4 (vérif + repli). ✓

**Placeholder scan :** aucun TBD/TODO ; chaque édition montre le texte exact ; chaque vérif a une commande et une sortie attendue.

**Type consistency :** noms de fichiers/chemins identiques entre tasks ; `cartography.sh`, `LAB_SECRETS_KEY`, `sysadmin/LAB_SSH_KEY_B64` orthographiés de manière constante avec le code source lu.

**Ordre :** Task 1 (gitignore) avant les régénérations (Tasks 2-3) pour qu'aucune sortie de `cartography.sh` n'apparaisse comme modif suivie.
