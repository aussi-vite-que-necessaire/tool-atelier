#!/usr/bin/env bash
# Test dépendance-zéro de bin/lab sur un repo git temporaire.
set -uo pipefail
fail() { echo "FAIL: $1" >&2; exit 1; }
ATELIER="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
cd "$TMP"; TMP="$(pwd -P)"   # chemin physique (macOS : /var → /private/var)
git init -q; git config user.email t@t; git config user.name t; git branch -M main
mkdir -p bin hello; echo "FROM scratch" > hello/Dockerfile
cp "$ATELIER/bin/lab" bin/lab; chmod +x bin/lab
git add -A; git commit -qm init

# new crée la branche + le worktree, et imprime le chemin
out="$(bin/lab new hello "Preview LinkedIn")" || fail "new a échoué"
[ -d ".claude/worktrees/hello-preview-linkedin" ] || fail "worktree absent"
git show-ref --verify --quiet refs/heads/work/hello-preview-linkedin || fail "branche absente"
[ "$out" = "$TMP/.claude/worktrees/hello-preview-linkedin" ] || fail "chemin imprimé inattendu: $out"

# projet inconnu => échec
bin/lab new nope x 2>/dev/null && fail "projet inconnu accepté"

# doublon => échec
bin/lab new hello "Preview LinkedIn" 2>/dev/null && fail "doublon accepté"

# ls liste le worktree créé
bin/lab ls | grep -q "hello-preview-linkedin" || fail "ls n'affiche pas le worktree"

# cd imprime le chemin
[ "$(bin/lab cd hello-preview-linkedin)" = "$TMP/.claude/worktrees/hello-preview-linkedin" ] \
  || fail "cd n'imprime pas le bon chemin"
bin/lab cd inexistant 2>/dev/null && fail "cd sur worktree inexistant accepté"

# rm refuse si le worktree est sale
echo brouillon > .claude/worktrees/hello-preview-linkedin/sale.txt
bin/lab rm hello-preview-linkedin 2>/dev/null && fail "rm a accepté un worktree sale"
rm .claude/worktrees/hello-preview-linkedin/sale.txt

# rm retire un worktree propre (la branche reste)
bin/lab rm hello-preview-linkedin || fail "rm a échoué sur worktree propre"
[ -d ".claude/worktrees/hello-preview-linkedin" ] && fail "worktree non retiré"
git show-ref --verify --quiet refs/heads/work/hello-preview-linkedin || fail "branche supprimée à tort"

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

echo "OK lab.test.sh"
