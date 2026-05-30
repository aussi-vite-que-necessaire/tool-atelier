#!/usr/bin/env bash
# Tests des fonctions de nommage pures de scripts/deploy.sh : host public primaire et liste
# Caddy, selon l'env (prod / integration / preview par-branche) et le flag apex. On SOURCE
# deploy.sh (garde source-safe) et on exerce les fonctions — pas de Docker, fonctions pures.
# Lance: bash test/deploy-hosts.test.sh
set -uo pipefail
fail() { echo "FAIL: $1" >&2; exit 1; }
ATELIER="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
DEPLOY="$ATELIER/scripts/deploy.sh"
eq() { [ "$1" = "$2" ] || fail "$3 — attendu '$2', obtenu '$1'"; }
h() { ( . "$DEPLOY" >/dev/null 2>&1; "$@" ); }

# prod — apex:false (défaut) → sous-domaine du projet ; apex:true → racine contentos.ch
eq "$(h compute_primary_host app prod)"          "app.contentos.ch"                      "prod host non-apex"
eq "$(h compute_primary_host app prod true)"     "contentos.ch"                          "prod host apex"
eq "$(h compute_caddy_hosts app prod)"           "app.contentos.ch"                      "prod caddy non-apex"
eq "$(h compute_caddy_hosts app prod true)"      "contentos.ch, www.contentos.ch"        "prod caddy apex+www"
# integration (noms propres sous *.preview)
eq "$(h compute_primary_host app integration)"   "app.preview.contentos.ch"              "integration host"
eq "$(h compute_caddy_hosts app integration)"    "app.preview.contentos.ch"              "integration caddy"
# preview par-branche (suffixe conservé → pas de collision)
eq "$(h compute_primary_host app sharp-ride)"    "app-sharp-ride.preview.contentos.ch"   "preview branche host"

echo "PASS: deploy-hosts.test.sh"
