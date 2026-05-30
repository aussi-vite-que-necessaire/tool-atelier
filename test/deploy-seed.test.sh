#!/usr/bin/env bash
# Tests des fonctions pures de provisioning de scripts/deploy.sh : mode clone/seed par env, nom de
# base borné, SQL de scrub, génération du site Caddy (avec/sans basic-auth). On SOURCE deploy.sh
# (garde source-safe) puis on neutralise son `set -euo` — pas de Docker, fonctions pures.
set -uo pipefail
fail() { echo "FAIL: $1" >&2; exit 1; }
ATELIER="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
# shellcheck disable=SC1091
. "$ATELIER/scripts/deploy.sh" >/dev/null 2>&1
set +e +u   # on garde les fonctions définies, sans le set -euo hérité de deploy.sh
eq() { [ "$1" = "$2" ] || fail "$3 — attendu '$2', obtenu '$1'"; }
has() { case "$1" in *"$2"*) : ;; *) fail "$3 — fragment '$2' absent" ;; esac; }
hasnt() { case "$1" in *"$2"*) fail "$3 — fragment '$2' présent à tort" ;; esac; }

# provision_mode
eq "$(provision_mode prod)"        "none"        "mode prod"
eq "$(provision_mode integration)" "clone-full"  "mode integration"
eq "$(provision_mode sharp-ride)"  "clone-scrub" "mode branche"

# db_name : court inchangé ; long borné à 63 car.
eq "$(db_name app integration)" "app_integration" "db_name integration"
eq "$(db_name app prod)"        "app_prod"        "db_name prod"
eq "$(db_name app sharp-ride)"  "app_sharp_ride"  "db_name slug (- → _)"
long="$(db_name app aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa)"
[ "${#long}" -le 63 ] || fail "db_name long doit être ≤63 (obtenu ${#long})"

# scrub_sql
scrub="$(scrub_sql)"
has "$scrub" "access_token = 'scrubbed'" "scrub neutralise les tokens"
has "$scrub" "DELETE FROM session"       "scrub vide les sessions"
has "$scrub" "op@contentos.test"         "scrub pose l'identité preview connue"

# caddy_site
plain="$(caddy_site 'app-x.preview.contentos.ch' 'app-x' '')"
has   "$plain" "reverse_proxy app-x:8080" "caddy reverse_proxy"
hasnt "$plain" "basic_auth"               "caddy sans basic = pas de basic_auth"
prot="$(caddy_site 'app.preview.contentos.ch' 'app-integration' 'manu $2a$14$xxx')"
has "$prot" "basic_auth"                  "caddy integration = basic_auth"
has "$prot" "manu \$2a\$14\$xxx"          "caddy basic_auth porte l'identifiant"

echo "PASS: deploy-seed.test.sh"
