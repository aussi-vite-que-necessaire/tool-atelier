#!/usr/bin/env bash
# Hook PreToolUse (matcher Bash) : bloque `git commit`/`git push` quand la branche courante est
# main/master. Garde-fou de feedback rapide en CLI (la vraie garantie = branch protection GitHub
# si activée). Lit le JSON du hook sur stdin. Échoue en "fail-open" (autorise) si jq absent.
set -uo pipefail

json="$(cat)"
command -v jq >/dev/null 2>&1 || exit 0   # pas de jq → ne bloque pas

cmd="$(printf '%s' "$json" | jq -r '.tool_input.command // ""')"
cwd="$(printf '%s' "$json" | jq -r '.cwd // "."')"

case "$cmd" in
  *"git commit"*|*"git push"*)
    branch="$(cd "$cwd" 2>/dev/null && git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")"
    if [ "$branch" = "main" ] || [ "$branch" = "master" ]; then
      printf 'Bloqué : jamais de commit/push sur "%s" dans l'\''atelier. Crée une branche (git switch -c <type>/<nom>) puis ouvre une PR (gh pr create). Le merge de la PR déclenche la prod ; un push de branche déploie une preview.\n' "$branch" >&2
      exit 2
    fi
    ;;
esac
exit 0
