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

echo "OK lab.test.sh"
