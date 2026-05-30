#!/usr/bin/env bash
# Tests des fonctions pures de scrub/nommage de scripts/deploy.sh + scripts/teardown.sh.
#   1. db_name() : deploy.sh et teardown.sh DOIVENT produire le même nom de base pour toute branche
#      (sinon le teardown vise le mauvais nom et orpheline la base d'un slug long).
#   2. scrub_sql() : le SQL de scrub d'un clone de prod retire bien tokens/hashes et anonymise les
#      identités et emails de contacts (utilisateurs + accès ressources), vide sessions/vérifs.
# On SOURCE les scripts (garde source-safe) dans des sous-shells — pas de Docker, fonctions pures.
# Lance: bash test/deploy-scrub.test.sh
set -uo pipefail
fail() { echo "FAIL: $1" >&2; exit 1; }
ATELIER="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
DEPLOY="$ATELIER/scripts/deploy.sh"
TEARDOWN="$ATELIER/scripts/teardown.sh"
eq() { [ "$1" = "$2" ] || fail "$3 — attendu '$2', obtenu '$1'"; }
has() { printf '%s' "$1" | grep -qF -- "$2" || fail "$3 — sous-chaîne absente: $2"; }

dn_deploy()   { ( . "$DEPLOY"   >/dev/null 2>&1; db_name "$@" ); }
dn_teardown() { ( . "$TEARDOWN" >/dev/null 2>&1; db_name "$@" ); }
scrub()       { ( . "$DEPLOY"   >/dev/null 2>&1; scrub_sql ); }

# --- 1. Parité db_name deploy/teardown (la clé pour zéro orphelin) ---
LONG="feature-really-long-descriptive-branch-name-for-some-epic-work-xyz"  # app_<env> > 63 car.
for env in prod integration sharp-ride feat-x "$LONG"; do
  d="$(dn_deploy app "$env")"; t="$(dn_teardown app "$env")"
  eq "$t" "$d" "db_name parité (env=$env)"
  [ "${#d}" -le 63 ] || fail "db_name dépasse 63 car. (env=$env): $d"
done
# Cas court : forme simple <proj>_<env>. Cas long : tronqué + hash (≠ forme naïve).
eq "$(dn_deploy app sharp-ride)" "app_sharp_ride" "db_name forme courte"
[ "$(dn_deploy app "$LONG")" != "app_$(printf '%s' "$LONG" | tr '-' '_')" ] \
  || fail "db_name long aurait dû être tronqué+hashé"

# --- 2. Contenu du scrub ---
S="$(scrub)"
has "$S" "UPDATE social_accounts SET access_token = 'scrubbed'"                "scrub: token social neutralisé"
has "$S" "UPDATE account SET access_token = NULL, refresh_token = NULL, id_token = NULL, scope = NULL, password = NULL" "scrub: tokens/hash auth purgés"
has "$S" "DELETE FROM session"                                                 "scrub: sessions vidées"
has "$S" "DELETE FROM verification"                                            "scrub: vérifs vidées"
has "$S" "UPDATE res_access SET email = 'res+'"                                "scrub: emails contacts ressources anonymisés"
has "$S" "email = 'op@contentos.test'"                                         "scrub: opérateur preview"
has "$S" "WHERE role = 'operator'"                                             "scrub: 1er opérateur ciblé"
has "$S" "(SELECT id FROM \"user\" ORDER BY created_at, id LIMIT 1)"           "scrub: fallback 1er utilisateur (COALESCE)"

echo "PASS: deploy-scrub.test.sh"
