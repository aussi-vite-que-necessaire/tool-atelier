#!/usr/bin/env bash
# Tests des fonctions de nommage pures de scripts/deploy.sh : host public primaire, liste Caddy,
# et AUTH_URL, selon l'env (prod / integration / preview par-branche, cas www). On SOURCE
# deploy.sh (garde source-safe) et on exerce les fonctions — pas de Docker, fonctions pures.
# Lance: bash test/deploy-hosts.test.sh
set -uo pipefail
fail() { echo "FAIL: $1" >&2; exit 1; }
ATELIER="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
DEPLOY="$ATELIER/scripts/deploy.sh"
eq() { [ "$1" = "$2" ] || fail "$3 — attendu '$2', obtenu '$1'"; }
h() { ( . "$DEPLOY" >/dev/null 2>&1; "$@" ); }

# prod
eq "$(h compute_primary_host media prod)"        "media.contentos.ch"                    "prod host"
eq "$(h compute_primary_host www prod)"          "contentos.ch"                          "prod www apex"
eq "$(h compute_caddy_hosts media prod)"         "media.contentos.ch"                    "prod caddy simple"
eq "$(h compute_caddy_hosts www prod)"           "contentos.ch, www.contentos.ch"        "prod www caddy apex+www"
# integration (noms propres sous *.preview)
eq "$(h compute_primary_host media integration)" "media.preview.contentos.ch"            "integration host"
eq "$(h compute_primary_host mcp integration)"   "mcp.preview.contentos.ch"              "integration mcp"
eq "$(h compute_caddy_hosts media integration)"  "media.preview.contentos.ch"            "integration caddy"
# preview par-branche (suffixe conservé → pas de collision)
eq "$(h compute_primary_host media sharp-ride)"  "media-sharp-ride.preview.contentos.ch" "preview branche host"
# AUTH_URL
eq "$(h compute_auth_url prod)"                  ""                                      "auth prod vide"
eq "$(h compute_auth_url integration)"           "https://auth.preview.contentos.ch"     "auth integration nom propre"
eq "$(h compute_auth_url sharp-ride)"            "https://auth-sharp-ride.preview.contentos.ch" "auth branche"

echo "PASS: deploy-hosts.test.sh"
