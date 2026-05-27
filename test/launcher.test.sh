#!/usr/bin/env bash
# Test du lanceur Atelier.command : il ne fait que sandboxer (local ou cloud).
# ATELIER_DRY_RUN=1 fait imprimer la commande de lancement au lieu de l'exec (et n'ouvre pas le web).
# Un `claude` bouchonné contrôle si --remote est « supporté ».
set -uo pipefail
fail() { echo "FAIL: $1" >&2; exit 1; }
ATELIER="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
CMD="$ATELIER/Atelier.command"

# Bouchon `claude` : son --help liste --worktree toujours, et --remote seulement si FAKE_REMOTE est posé.
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
cat > "$TMP/claude" <<'EOF'
#!/usr/bin/env bash
if [ "$1" = "--help" ]; then
  echo "  --worktree [name]   Create a new git worktree for this session"
  [ -n "${FAKE_REMOTE:-}" ] && echo "  --remote [value]    Start a cloud session"
  exit 0
fi
EOF
chmod +x "$TMP/claude"
export PATH="$TMP:$PATH"

# local → claude --worktree (pas de détection nécessaire)
out="$(ATELIER_DRY_RUN=1 "$CMD" local)" || fail "mode local a échoué"
printf '%s' "$out" | grep -q "claude --worktree" || fail "local ne lance pas 'claude --worktree' (got: $out)"

# cloud, CLI supportant --remote → claude --remote avec amorçage /start sans tâche
out="$(FAKE_REMOTE=1 ATELIER_DRY_RUN=1 "$CMD" cloud)" || fail "mode cloud (--remote dispo) a échoué"
printf '%s' "$out" | grep -q "claude --remote" || fail "cloud ne lance pas 'claude --remote' (got: $out)"
printf '%s' "$out" | grep -q "/start"          || fail "amorçage cloud ne déclenche pas /start (got: $out)"
printf '%s' "$out" | grep -qi "aucune tâche"    || fail "amorçage cloud ne dit pas de ne choisir aucune tâche"

# cloud, CLI sans --remote → repli web clair, jamais 'claude --remote'
out="$(ATELIER_DRY_RUN=1 "$CMD" cloud 2>&1)" || fail "mode cloud (repli) a échoué"
printf '%s' "$out" | grep -q "claude.ai/code"   || fail "repli cloud ne pointe pas vers claude.ai/code (got: $out)"
printf '%s' "$out" | grep -q "claude --remote"   && fail "repli cloud tente 'claude --remote' alors que non supporté"

# Choix interactif sur stdin : 1 → local, 2 → cloud (avec --remote dispo)
out="$(printf '1\n' | ATELIER_DRY_RUN=1 "$CMD")" || fail "choix interactif 1 a échoué"
printf '%s' "$out" | grep -q "claude --worktree" || fail "choix 1 ne donne pas local (got: $out)"

out="$(printf '2\n' | FAKE_REMOTE=1 ATELIER_DRY_RUN=1 "$CMD")" || fail "choix interactif 2 a échoué"
printf '%s' "$out" | grep -q "claude --remote" || fail "choix 2 ne donne pas cloud (got: $out)"

# Choix invalide → erreur (sortie non nulle)
printf 'xyz\n' | ATELIER_DRY_RUN=1 "$CMD" >/dev/null 2>&1 && fail "choix invalide accepté à tort"

echo "OK launcher.test.sh"
