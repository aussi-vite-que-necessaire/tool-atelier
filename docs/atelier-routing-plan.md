# Routage d'entrée — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Le launcher `lab` devient le routeur d'entrée complet, et le hook SessionStart devient scope-aware (accueil projet sans menu dans une session focalisée).

**Architecture:** Les choix du routeur qui créent un worktree sont des sous-commandes testables (`lab create`, `lab meta`, déjà `lab new`) ; le menu interactif (`lab menu`) les appelle et lance `claude`. Le hook `session-start.sh` détecte le scope via la branche/worktree et injecte l'accueil adapté. Tests bash dépendance-zéro sur repo temporaire.

**Tech Stack:** Bash, git worktree, jq, hooks Claude Code.

**Contexte d'exécution :** worktree `chore/atelier-routing` (déjà créé). Travailler avec le cwd de session DANS ce worktree (le garde-fou évalue le cwd de session ; commiter depuis un cwd posé dans le worktree).

---

## File Structure

- `bin/lab` (modifier) — ajout `cmd_create`, `cmd_meta` ; `cmd_menu` réécrit en routeur complet ; cases ajoutées.
- `test/lab.test.sh` (modifier) — couvre `create` et `meta`.
- `.claude/hooks/session-start.sh` (réécrire) — détection de scope → accueil adapté.
- `test/session-start.test.sh` (créer) — vérifie l'accueil selon le scope.
- `.claude/skills/start/SKILL.md` (modifier) — recadré en routeur de secours.
- `CLAUDE.md` (modifier) — démarrage via `lab`, skills.

---

## Task 1: `lab create` et `lab meta` (worktrees bootstrap)

**Files:**
- Modify: `bin/lab`
- Modify: `test/lab.test.sh`

- [ ] **Step 1: Étendre le test (échoue)**

Ajouter dans `test/lab.test.sh`, juste avant `echo "OK lab.test.sh"` :

```bash
# create : worktree bootstrap pour un NOUVEAU projet (qui n'existe pas encore)
out="$(bin/lab create monapp)" || fail "create a échoué"
[ -d ".claude/worktrees/new-monapp" ] || fail "worktree de création absent"
git show-ref --verify --quiet refs/heads/work/new-monapp || fail "branche de création absente"
[ "$out" = "$TMP/.claude/worktrees/new-monapp" ] || fail "create : chemin inattendu: $out"
bin/lab create hello 2>/dev/null && fail "create a accepté un projet existant"

# meta : worktree de plomberie de l'atelier
out="$(bin/lab meta routage)" || fail "meta a échoué"
[ -d ".claude/worktrees/atelier-routage" ] || fail "worktree meta absent"
git show-ref --verify --quiet refs/heads/chore/atelier-routage || fail "branche meta absente"
[ "$out" = "$TMP/.claude/worktrees/atelier-routage" ] || fail "meta : chemin inattendu: $out"
```

- [ ] **Step 2: Lancer le test, vérifier l'échec**

Run: `bash test/lab.test.sh`
Expected: FAIL sur `create a échoué` (sous-commande absente → `usage`)

- [ ] **Step 3: Implémenter `cmd_create` et `cmd_meta`**

Dans `bin/lab`, ajouter ces fonctions avant le bloc `case` final :

```bash
cmd_create() {
  local nom="${1:-}"; [ -n "$nom" ] || usage
  local s; s="$(slug "$nom")"
  [ -e "$ROOT/$s" ] && { echo "lab: le projet '$s' existe déjà — utilise: lab new $s <libellé>" >&2; exit 1; }
  local branch="work/new-$s" path="$WT_DIR/new-$s"
  [ -e "$path" ] && { echo "lab: worktree déjà présent: $path" >&2; exit 1; }
  git -C "$ROOT" show-ref --verify --quiet "refs/heads/$branch" \
    && { echo "lab: branche déjà prise: $branch" >&2; exit 1; }
  git -C "$ROOT" worktree add -q -b "$branch" "$path" >/dev/null
  echo "worktree de création prêt : $branch" >&2
  echo "$path"
}

cmd_meta() {
  local label="${1:-atelier}"
  local s; s="$(slug "$label")"
  local branch="chore/atelier-$s" path="$WT_DIR/atelier-$s"
  [ -e "$path" ] && { echo "lab: worktree déjà présent: $path" >&2; exit 1; }
  git -C "$ROOT" show-ref --verify --quiet "refs/heads/$branch" \
    && { echo "lab: branche déjà prise: $branch" >&2; exit 1; }
  git -C "$ROOT" worktree add -q -b "$branch" "$path" >/dev/null
  echo "worktree plomberie prêt : $branch" >&2
  echo "$path"
}
```

Et compléter le `case` final avec `create` et `meta` :

```bash
case "$sub" in
  new)    cmd_new "$@" ;;
  create) cmd_create "$@" ;;
  meta)   cmd_meta "$@" ;;
  ls)     cmd_ls ;;
  cd)     cmd_cd "$@" ;;
  rm)     cmd_rm "$@" ;;
  menu)   cmd_menu ;;
  *)      usage ;;
esac
```

- [ ] **Step 4: Lancer le test, vérifier le succès**

Run: `bash test/lab.test.sh`
Expected: `OK lab.test.sh`

- [ ] **Step 5: Commit**

```bash
git add bin/lab test/lab.test.sh
git commit -m "✨ lab : sous-commandes create (nouveau projet) et meta (plomberie de l'atelier)"
```

---

## Task 2: `lab menu` — routeur d'entrée complet

`cmd_menu` existe déjà (version simple) ; on le remplace par le routeur 6 choix. Interactif (lit l'entrée, lance `claude`) → vérification manuelle, pas de test auto.

**Files:**
- Modify: `bin/lab` (remplacer `cmd_menu`)

- [ ] **Step 1: Remplacer `cmd_menu`**

Remplacer la fonction `cmd_menu` existante par :

```bash
cmd_menu() {
  echo "Atelier — qu'est-ce qu'on fait ?" >&2
  echo "  1) Bosser sur un projet" >&2
  echo "  2) Créer un projet" >&2
  echo "  3) Plomberie de l'atelier (CLAUDE.md, skills, lab, hooks)" >&2
  echo "  4) Lister les projets" >&2
  echo "  5) Infra / plateforme" >&2
  echo "  6) Autre" >&2
  printf 'Choix ? ' >&2; read -r c
  local path
  case "$c" in
    1) local projects=() d; for d in "$ROOT"/*/; do [ -f "$d/Dockerfile" ] && projects+=("$(basename "$d")"); done
       [ "${#projects[@]}" -gt 0 ] || { echo "aucun projet" >&2; exit 1; }
       local i=1 p; for p in "${projects[@]}"; do printf '  %d) %s\n' "$i" "$p" >&2; i=$((i+1)); done
       printf 'Projet (numéro) ? ' >&2; read -r pc; local proj="${projects[$((pc-1))]:-}"
       [ -n "$proj" ] || { echo "choix invalide" >&2; exit 1; }
       printf 'Libellé ? ' >&2; read -r label
       path="$(cmd_new "$proj" "${label:-session}")"; cd "$path" && exec claude ;;
    2) printf 'Nom du nouveau projet ? ' >&2; read -r nom
       path="$(cmd_create "$nom")"; cd "$path" && exec claude "Crée le projet $nom dans l'atelier : lance /lab-new $nom." ;;
    3) printf 'Libellé de la tâche (plomberie) ? ' >&2; read -r label
       path="$(cmd_meta "$label")"; cd "$path" && exec claude ;;
    4) exec claude "Liste les projets de l'atelier : lance /lab-list." ;;
    5) exec claude "Parlons infra / plateforme de l'atelier." ;;
    6) exec claude ;;
    *) echo "choix invalide" >&2; exit 1 ;;
  esac
}
```

- [ ] **Step 2: Non-régression + vérification manuelle**

Run: `bash test/lab.test.sh`
Expected: `OK lab.test.sh` (les sous-commandes restent intactes)

Vérif manuelle (interactif) : `./bin/lab menu` affiche les 6 choix ; choisir « 3 » + un libellé crée un worktree `atelier-<libellé>` et lance `claude`. (Non automatisé : lit l'entrée et lance `claude`.)

- [ ] **Step 3: Commit**

```bash
git add bin/lab
git commit -m "✨ lab : menu = routeur d'entrée complet (projet / créer / plomberie / lister / infra / autre)"
```

---

## Task 3: Hook SessionStart scope-aware

**Files:**
- Reécrire: `.claude/hooks/session-start.sh`
- Create: `test/session-start.test.sh`

- [ ] **Step 1: Écrire le test (échoue)**

Créer `test/session-start.test.sh` :

```bash
#!/usr/bin/env bash
# Vérifie l'accueil SessionStart selon le scope.
set -uo pipefail
fail() { echo "FAIL: $1" >&2; exit 1; }
ATELIER="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
HOOK="$ATELIER/.claude/hooks/session-start.sh"
command -v jq >/dev/null 2>&1 || { echo "SKIP session-start.test.sh (jq absent)"; exit 0; }

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
MAIN="$TMP/main"; git init -q "$MAIN"; MAIN="$(cd "$MAIN" && pwd -P)"
( cd "$MAIN"; git config user.email t@t; git config user.name t; git branch -M main
  mkdir hello; echo "FROM scratch" > hello/Dockerfile; git add -A; git commit -qm init
  git branch work/hello-essai; git branch chore/atelier-x )
HW="$TMP/hw"; git -C "$MAIN" worktree add -q "$HW" work/hello-essai
MW="$TMP/mw"; git -C "$MAIN" worktree add -q "$MW" chore/atelier-x

run() { ( cd "$1" && "$HOOK" ); }   # le hook lit son cwd

run "$MAIN" | grep -q "checkout principal" || fail "checkout principal non détecté"
run "$HW"   | grep -q "hello"              || fail "scope projet hello non détecté"
run "$MW"   | grep -q "plomberie"          || fail "scope plomberie non détecté"

echo "OK session-start.test.sh"
```

- [ ] **Step 2: Lancer le test, vérifier l'échec**

Run: `bash test/session-start.test.sh`
Expected: FAIL (le hook actuel renvoie toujours le menu 5-options, pas « checkout principal » / « hello » / « plomberie »)

- [ ] **Step 3: Réécrire `.claude/hooks/session-start.sh`**

```bash
#!/usr/bin/env bash
# Hook SessionStart : accueil adapté au scope de la session (le hook lit son cwd).
#   - worktree lié sur work/<projet>-… → accueil projet (pas de menu).
#   - worktree lié sur chore/atelier-… → accueil plomberie.
#   - autre worktree lié → accueil session isolée.
#   - checkout principal → pointe vers le launcher `lab`.
set -uo pipefail

emit() {
  jq -nc --arg c "$1" '{hookSpecificOutput:{hookEventName:"SessionStart",additionalContext:$c}}' 2>/dev/null \
    || printf '%s\n' "$1"
}

git rev-parse --git-dir >/dev/null 2>&1 || { emit "🛠️ Atelier (hors dépôt git)."; exit 0; }
branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '')"
gd="$(git rev-parse --absolute-git-dir 2>/dev/null)"
gcd="$(cd "$(git rev-parse --git-common-dir 2>/dev/null)" 2>/dev/null && pwd -P)"
root="$(git rev-parse --show-toplevel 2>/dev/null)"
linked=0; [ -n "$gd" ] && [ "$gd" != "$gcd" ] && linked=1

proj=""
case "$branch" in
  work/*)
    for d in "$root"/*/; do
      [ -f "$d/Dockerfile" ] || continue
      p="$(basename "$d")"
      if [ "$branch" = "work/$p" ] || [ "${branch#work/$p-}" != "$branch" ]; then proj="$p"; break; fi
    done ;;
esac

if [ "$linked" = "1" ] && [ -n "$proj" ]; then
  emit "🛠️ Session sur **$proj** (branche \`$branch\`). Lis \`$proj/CLAUDE.md\`, travaille uniquement dans \`$proj/\`. On continue ? Rappel : jamais de commit sur main ; push de branche = preview, PR mergée = prod."
elif [ "$linked" = "1" ] && [ "${branch#chore/atelier-}" != "$branch" ]; then
  emit "🛠️ Session **plomberie de l'atelier** (branche \`$branch\`). Tu peux faire évoluer \`CLAUDE.md\`, les skills, \`bin/lab\`, les hooks. Jamais de commit sur main ; livraison par PR."
elif [ "$linked" = "1" ]; then
  emit "🛠️ Session isolée (branche \`$branch\`). Jamais de commit sur main ; livraison par PR."
else
  emit "🛠️ Atelier — **checkout principal**. Pour bosser, lance \`lab\` (ou double-clique \`Atelier.command\`) et choisis quoi faire. Déjà dans claude ici ? Lance \`/start\`. Le garde-fou interdit le dev projet dans le checkout principal."
fi
exit 0
```

- [ ] **Step 4: Lancer le test, vérifier le succès**

Run: `chmod +x .claude/hooks/session-start.sh && bash test/session-start.test.sh`
Expected: `OK session-start.test.sh`

- [ ] **Step 5: Commit**

```bash
git add .claude/hooks/session-start.sh test/session-start.test.sh
git commit -m "✨ démarrage : accueil SessionStart adapté au scope (projet / plomberie / base)"
```

---

## Task 4: Recadrer `/start` + mettre à jour `CLAUDE.md`

**Files:**
- Modify: `.claude/skills/start/SKILL.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Recadrer `/start`**

Remplacer le corps de `.claude/skills/start/SKILL.md` (après le frontmatter) par :

```markdown
# /start — routeur de secours dans claude

Routeur **de secours** : utilisé quand tu ouvres `claude` brut dans le checkout principal de
l'atelier (l'entrée normale est le launcher `lab` / `Atelier.command`). Les sessions déjà
focalisées sur un projet ne passent pas par ici.

Demande à Manu ce qu'il veut faire (via `AskUserQuestion`), puis oriente :

1. **Bosser sur un projet existant** → `/lab-list`, demande lequel, puis `/lab-work <projet>` (ou rappelle que `lab new <projet> <libellé>` ouvre une session isolée).
2. **Créer un projet** → `/lab-new`.
3. **Plomberie de l'atelier** (CLAUDE.md, skills, hooks) → rappelle d'isoler le travail (`lab meta <libellé>`).
4. **Lister les projets** → `/lab-list`.
5. **Infra / plateforme** → gérée **hors de l'atelier** ; les secrets applicatifs, eux, via `/lab-secret`.
6. **Autre** → demande en prose.

**Règle transverse :** jamais de commit sur `main`. Branche → push = preview ; PR mergée = prod.
```

- [ ] **Step 2: Mettre à jour le démarrage dans `CLAUDE.md`**

Remplacer la première ligne de la section « ## Au démarrage : qu'est-ce qu'on fait ? » :

> À l'ouverture, lance la skill **`/start`** : elle demande quoi faire (bosser sur un projet /
> créer / lister / infra / autre) et oriente. Skills disponibles :

par :

```markdown
L'entrée de l'atelier est le launcher **`lab`** (ou double-clic **`Atelier.command`**) : il
demande quoi faire et prépare le bon contexte (worktree isolé) avant de lancer `claude`. Si tu
ouvres `claude` brut dans le checkout principal, lance **`/start`** (routeur de secours). Skills disponibles :
```

- [ ] **Step 3: Vérifier la cohérence**

Run: `grep -q "launcher \*\*\`lab\`\*\*" CLAUDE.md && echo OK-CLAUDE`
Expected: `OK-CLAUDE`

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/start/SKILL.md CLAUDE.md
git commit -m "📝 atelier : entrée par le launcher lab ; /start recadré en routeur de secours"
```

---

## Self-Review

**Spec coverage :**
- Launcher routeur complet (6 choix) → Task 1 (create/meta) + Task 2 (menu). ✓
- Worktree bootstrap « créer un projet » → Task 1 `cmd_create`. ✓
- Option « plomberie de l'atelier » → Task 1 `cmd_meta` + Task 2 choix 3. ✓
- Hook SessionStart scope-aware (projet / plomberie / base + worktree générique) → Task 3. ✓
- `/start` recadré en routeur de secours → Task 4. ✓
- `CLAUDE.md` démarrage via `lab` → Task 4. ✓
- Détection de scope (branche work/<projet>-…, chore/atelier-…) → Task 3 (cohérent avec les noms produits par Task 1). ✓
- Hors scope (sessions cloud) → non traité, comme prévu.

**Placeholders :** aucun ; code et tests complets.

**Cohérence des noms :** `cmd_new`/`cmd_create`/`cmd_meta`/`cmd_menu`, branches `work/<projet>-…`, `work/new-<nom>`, `chore/atelier-<libellé>`, worktrees `.claude/worktrees/<nom>` — identiques entre `bin/lab` (Task 1-2), le hook (Task 3) et les tests.
