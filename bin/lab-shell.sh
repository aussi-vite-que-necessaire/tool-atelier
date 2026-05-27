# Source-moi depuis ton shell : source <repo>/bin/lab-shell.sh
# Fournit la commande `lab` qui, pour `new`/`cd`, dépose ton terminal dans le worktree.
_lab_self="${BASH_SOURCE[0]:-${(%):-%x}}"
LAB_BIN="$(cd "$(dirname "$_lab_self")" && pwd -P)/lab"

lab() {
  case "${1:-}" in
    new|cd)
      local out path
      out="$("$LAB_BIN" "$@")" || { printf '%s\n' "$out" >&2; return 1; }
      path="$(printf '%s\n' "$out" | tail -1)"
      if [ -d "$path" ]; then
        cd "$path" || return 1
        echo "→ $(pwd) ($(git rev-parse --abbrev-ref HEAD)). Lance: claude"
      else
        printf '%s\n' "$out"
      fi
      ;;
    *) "$LAB_BIN" "$@" ;;
  esac
}
