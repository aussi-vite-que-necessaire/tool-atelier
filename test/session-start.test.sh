#!/usr/bin/env bash
# Tests du hook session-start.sh — message d'accueil (modèle cloud, 1 session = 1 branche).
# Lance: bash test/session-start.test.sh
set -uo pipefail
fail() { echo "FAIL: $1" >&2; exit 1; }
ATELIER="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
HOOK="$ATELIER/.claude/hooks/session-start.sh"
command -v jq >/dev/null 2>&1 || { echo "SKIP session-start.test.sh (jq absent)"; exit 0; }

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
REPO="$TMP/repo"; git init -q "$REPO"; REPO="$(cd "$REPO" && pwd -P)"
( cd "$REPO"; git config user.email t@t; git config user.name t; git branch -M main
  git commit -qm init --allow-empty )

run() { ( cd "$1" && "$HOOK" ); }   # le hook lit son cwd

# Sur main : invite à basculer sur une branche de session, oriente vers /start.
run "$REPO" | grep -q "git switch -c" || fail "main n'invite pas à basculer sur une branche"
run "$REPO" | grep -q "/start"        || fail "main n'oriente pas vers /start"

# Sur une branche de session : message session isolée, nomme la branche, oriente vers /start,
# sans aucune mention de worktree ni de lanceur local.
git -C "$REPO" switch -c work/iso -q
run "$REPO" | grep -q "session isolée" || fail "branche de session non annoncée comme isolée"
run "$REPO" | grep -q "work/iso"       || fail "branche de session non nommée"
run "$REPO" | grep -q "/start"         || fail "branche de session n'oriente pas vers /start"
run "$REPO" | grep -qi "worktree" && fail "le message mentionne encore worktree"
run "$REPO" | grep -q "Atelier.command" && fail "le message mentionne encore le lanceur local"

echo "OK session-start.test.sh"
