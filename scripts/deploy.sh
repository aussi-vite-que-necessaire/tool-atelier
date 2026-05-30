#!/usr/bin/env bash
# Déploie un projet sur lab. Exécuté SUR lab (copié par la CI). Le serveur ne build jamais :
# il pull l'image construite par la CI, auto-provisionne les données déclarées dans lab.json,
# puis compose up + écrit la route Caddy.
#
# Usage: deploy.sh <projet> <env> <images>
#   <images> peut être :
#     - mono   : "ghcr.io/.../atelier-<projet>:<env>"          → IMAGE=… dans .env (historique)
#     - multi  : "web=ghcr.io/...,worker=ghcr.io/..."          → IMAGE_<ROLE>=… dans .env
#   En multi, l'image one-shot `migrate`/`seed` est celle du rôle `web` (à défaut le 1er rôle).
set -euo pipefail

# Retry/backoff sur `docker pull` : GHCR est ponctuellement flaky. PULL_MAX_ATTEMPTS tentatives,
# backoff exponentiel (2s, 4s, 8s…). Renvoie non-zéro à l'épuisement → `set -e` arrête le deploy
# avant tout `compose up` (jamais d'env à moitié monté).
retry_pull() {
  local ref="$1" n=1 max="${PULL_MAX_ATTEMPTS:-3}" base="${PULL_BACKOFF_BASE:-2}" delay
  until docker pull "$ref"; do
    if [ "$n" -ge "$max" ]; then
      echo "::error::docker pull échoué après $max tentatives: $ref" >&2
      return 1
    fi
    delay=$(( base ** n ))
    echo "⚠ docker pull $ref échoué (tentative $n/$max) — nouvel essai dans ${delay}s" >&2
    sleep "$delay"
    n=$(( n + 1 ))
  done
}

# Verrou global du lab : un seul deploy/teardown à la fois sur le daemon Docker, toutes
# sessions/branches confondues (`max-parallel:1` ne sérialise qu'au sein d'un run CI ; deux
# branches/agents poussant ensemble lancent sinon deux deploys concurrents → pression RAM +
# erreurs de lease containerd). flock noyau, libéré automatiquement à la mort du process (pas de
# verrou fantôme). Attente bloquante avec timeout → échec visible plutôt que pendre à l'infini.
acquire_deploy_lock() {
  exec 9>"${DEPLOY_LOCKFILE:-/opt/lab/deploy.lock}"
  flock -w "${DEPLOY_LOCK_TIMEOUT:-600}" 9 \
    || { echo "::error::verrou deploy non acquis après ${DEPLOY_LOCK_TIMEOUT:-600}s" >&2; exit 1; }
}

# Host public primaire selon l'env (fonction pure, testable) :
#   prod        → <projet>.contentos.ch (apex:true → contentos.ch)
#   integration → <projet>.preview.contentos.ch (noms propres, suite assemblée sur le palier)
#   <branche>   → <projet>-<branche>.preview.contentos.ch (preview par-branche, suffixe conservé)
compute_primary_host() {
  local proj="$1" env="$2" apex="${3:-false}"
  if [ "$env" = "prod" ]; then
    if [ "$apex" = "true" ]; then echo "contentos.ch"; else echo "${proj}.contentos.ch"; fi
  elif [ "$env" = "integration" ]; then
    echo "${proj}.preview.contentos.ch"
  else
    echo "${proj}-${env}.preview.contentos.ch"
  fi
}
# Liste Caddy (séparée par virgule) : apex en prod sert contentos.ch + www.contentos.ch,
# sinon = host primaire.
compute_caddy_hosts() {
  local proj="$1" env="$2" apex="${3:-false}"
  if [ "$env" = "prod" ] && [ "$apex" = "true" ]; then
    echo "contentos.ch, www.contentos.ch"
  else
    compute_primary_host "$proj" "$env" "$apex"
  fi
}

# Sourcé (tests) : on s'arrête après les définitions de fonctions, sans exécuter le deploy.
(return 0 2>/dev/null) && return 0

PROJ="$1"; ENV="$2"; IMAGES="$3"
# Verrou global pris au plus tôt : toute la suite touche le daemon Docker (pull, exec, compose).
acquire_deploy_lock
APPDIR="/opt/lab/apps/${PROJ}-${ENV}"
UPSTREAM="${PROJ}-${ENV}"

# jq requis pour lire lab.json — auto-install si absent (serveur fraîchement provisionné)
command -v jq >/dev/null 2>&1 || { apt-get update -qq && apt-get install -y -qq jq; }
# age requis pour déchiffrer les secrets — auto-install si absent
command -v age >/dev/null 2>&1 || { apt-get update -qq && apt-get install -y -qq age; }

# Auth GHCR (images privées) si un token est posé sur le serveur
if [ -f /opt/lab/ghcr.env ]; then
  # shellcheck disable=SC1091
  . /opt/lab/ghcr.env
  printf '%s' "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USER" --password-stdin >/dev/null
fi

# Parse <images> : mono (pas de '=') ou multi ("role=ref,role=ref"). Pull chaque image,
# stocke les paires dans deux tableaux parallèles ROLES/REFS, et choisit MIGRATE_IMAGE :
# rôle `web` si présent, sinon premier rôle, sinon (mono) l'image elle-même.
ROLES=(); REFS=(); MIGRATE_IMAGE=""
if [ "${IMAGES#*=}" = "$IMAGES" ]; then
  # mono — pas de '='
  ROLES=(""); REFS=("$IMAGES"); MIGRATE_IMAGE="$IMAGES"
else
  IFS=',' read -ra _PAIRS <<< "$IMAGES"
  for pair in "${_PAIRS[@]}"; do
    role="${pair%%=*}"; ref="${pair#*=}"
    [ -n "$role" ] && [ -n "$ref" ] || { echo "::error::pair invalide: $pair"; exit 1; }
    ROLES+=("$role"); REFS+=("$ref")
    [ "$role" = "web" ] && MIGRATE_IMAGE="$ref"
  done
  [ -n "$MIGRATE_IMAGE" ] || MIGRATE_IMAGE="${REFS[0]}"
fi
for ref in "${REFS[@]}"; do retry_pull "$ref"; done

mkdir -p "$APPDIR"
umask 077
{
  echo "UPSTREAM=$UPSTREAM"
  echo "APP_ENV=$ENV"
  # mono : variable historique IMAGE=… ; multi : une variable IMAGE_<ROLE> par rôle.
  if [ "${#ROLES[@]}" -eq 1 ] && [ -z "${ROLES[0]}" ]; then
    echo "IMAGE=${REFS[0]}"
  else
    for i in "${!ROLES[@]}"; do
      role_upper="$(printf '%s' "${ROLES[$i]}" | tr '[:lower:]' '[:upper:]')"
      echo "IMAGE_${role_upper}=${REFS[$i]}"
    done
  fi
} > "$APPDIR/.env"

# Besoins déclarés par le projet (lab.json absent => projet sans base ni redis)
# .db accepte : true (base propre <projet>_<env>) | {"shared":"X"} (réutilise la base de X) | false.
DB=false; DB_SHARED_FROM=""; REDIS=false; EMAIL=false; BROWSER=false; MIGRATE=""; SEED=""; APEX=false
if [ -f "$APPDIR/lab.json" ]; then
  DB="$(jq -r 'if (.db|type)=="object" then "shared" elif (.db // false) then "true" else "false" end' "$APPDIR/lab.json")"
  DB_SHARED_FROM="$(jq -r '(.db | objects | .shared) // empty' "$APPDIR/lab.json")"
  REDIS="$(jq -r '.redis // false' "$APPDIR/lab.json")"
  EMAIL="$(jq -r '.email // false' "$APPDIR/lab.json")"
  BROWSER="$(jq -r '.browser // false' "$APPDIR/lab.json")"
  MIGRATE="$(jq -r '.migrate // empty' "$APPDIR/lab.json")"
  SEED="$(jq -r '.seed // empty' "$APPDIR/lab.json")"
  APEX="$(jq -r '.apex // false' "$APPDIR/lab.json")"
fi

# Hosts publics (cf. fonctions pures ci-dessus) : prod sous *.contentos.ch (apex → contentos.ch
# + www.contentos.ch), integration sous <projet>.preview.contentos.ch (noms propres), preview
# par-branche suffixée. PRIMARY_HOST = identité publique (APP_URL, logs) ; HOSTS_CADDY = route.
PRIMARY_HOST="$(compute_primary_host "$PROJ" "$ENV" "$APEX")"
HOSTS_CADDY="$(compute_caddy_hosts "$PROJ" "$ENV" "$APEX")"

# Postgres central : DATABASE_URL injecté.
#   db:true            → base propre <projet>_<env> (créée si absente, migrée/seedée par ce projet).
#   db:{shared:"X"}    → réutilise la base X_<env> d'un autre projet (backend partagé). Ne crée
#                        RIEN et ne migre/seed pas : le projet propriétaire (X) gère son schéma.
if [ "$DB" = "true" ] || [ "$DB" = "shared" ]; then
  # shellcheck disable=SC1091
  . /opt/lab/platform/.env   # LAB_POSTGRES_PASSWORD
  if [ "$DB" = "shared" ]; then
    [ -n "$DB_SHARED_FROM" ] || { echo "::error::db.shared vide dans lab.json"; exit 1; }
    DBNAME="${DB_SHARED_FROM}_$(printf '%s' "$ENV" | tr '-' '_')"
  else
    DBNAME="${PROJ}_$(printf '%s' "$ENV" | tr '-' '_')"
    docker exec lab-platform-postgres-1 psql -U postgres -tAc \
      "SELECT 1 FROM pg_database WHERE datname='${DBNAME}'" | grep -q 1 \
      || docker exec lab-platform-postgres-1 createdb -U postgres "${DBNAME}"
  fi
  printf 'DATABASE_URL=postgres://postgres:%s@postgres:5432/%s\n' "$LAB_POSTGRES_PASSWORD" "$DBNAME" >> "$APPDIR/.env"
fi

# Redis central : URL + préfixe de namespace
if [ "$REDIS" = "true" ]; then
  printf 'REDIS_URL=redis://redis:6379\nREDIS_PREFIX=%s:%s:\n' "$PROJ" "$ENV" >> "$APPDIR/.env"
fi

# Chromium partagé (browserless central sur le réseau lab) : URL CDP injectée
if [ "$BROWSER" = "true" ]; then
  # /opt/lab/platform/.env porte LAB_BROWSER_URL (ex. ws://browser:3000?token=…)
  LAB_BROWSER_URL=""
  [ -f /opt/lab/platform/.env ] && . /opt/lab/platform/.env
  if [ -n "${LAB_BROWSER_URL:-}" ]; then
    printf 'BROWSER_URL=%s\n' "$LAB_BROWSER_URL" >> "$APPDIR/.env"
  else
    echo "⚠ browser: true mais LAB_BROWSER_URL absent de /opt/lab/platform/.env (skip) — provisionner browserless."
  fi
fi

# Email partagé (Resend) : clé de plateforme injectée si déclaré et disponible sur lab
if [ "$EMAIL" = "true" ]; then
  # /opt/lab/platform/.env porte RESEND_API_KEY (+ EMAIL_FROM) au niveau plateforme
  RESEND_API_KEY=""; EMAIL_FROM=""
  [ -f /opt/lab/platform/.env ] && . /opt/lab/platform/.env
  if [ -n "${RESEND_API_KEY:-}" ]; then
    printf 'RESEND_API_KEY=%s\nEMAIL_FROM=%s\n' "$RESEND_API_KEY" "${EMAIL_FROM:-onboarding@resend.dev}" >> "$APPDIR/.env"
  else
    echo "⚠ email: true mais RESEND_API_KEY absent de /opt/lab/platform/.env (skip) — poser la clé une fois pour activer."
  fi
fi

# Secrets applicatifs chiffrés (age) : global puis projet, déchiffrés avec la clé posée sur lab
# (/opt/lab/secrets-key) et injectés dans l'env partagé (web + worker + migrate one-shot).
# Ordre : global d'abord, projet ensuite → le projet peut surcharger une valeur globale.
# sysadmin n'est JAMAIS injecté. Fichiers copiés par la CI dans $APPDIR (déjà chiffrés).
if [ -f /opt/lab/secrets-key ]; then
  [ -f "$APPDIR/global.env.age" ]          && age -d -i /opt/lab/secrets-key "$APPDIR/global.env.age"          >> "$APPDIR/.env"
  [ -f "$APPDIR/${PROJ}.env.age" ]         && age -d -i /opt/lab/secrets-key "$APPDIR/${PROJ}.env.age"         >> "$APPDIR/.env"
fi

# Origine publique injectée dans APP_URL = host primaire du déploiement. Écrite APRÈS les
# secrets pour être autoritative — en --env-file la dernière occurrence d'une clé gagne.
# L'auth in-app (BetterAuth) utilise cette origine ; pas d'AUTH_URL séparé.
printf 'APP_URL=https://%s\n' "$PRIMARY_HOST" >> "$APPDIR/.env"

# Migrations (toujours) puis seed (hors prod) — conteneur one-shot sur le réseau lab.
# En multi-image, le rôle `web` porte drizzle + scripts (cf. Dockerfile target `web`).
if [ -n "$MIGRATE" ]; then
  docker run --rm --network lab --env-file "$APPDIR/.env" "$MIGRATE_IMAGE" sh -c "$MIGRATE"
fi
if [ -n "$SEED" ] && [ "$ENV" != "prod" ]; then
  docker run --rm --network lab --env-file "$APPDIR/.env" "$MIGRATE_IMAGE" sh -c "$SEED"
fi

# --force-recreate : applique les changements de .env (secrets) même quand l'image est identique
# (sinon une rotation de secret seule ne serait pas prise en compte).
docker compose -p "${PROJ}-${ENV}" --env-file "$APPDIR/.env" -f "$APPDIR/compose.yml" up -d --force-recreate

mkdir -p /opt/lab/platform/sites
cat > "/opt/lab/platform/sites/${PROJ}-${ENV}.caddy" <<EOF
${HOSTS_CADDY} {
	reverse_proxy ${UPSTREAM}:8080
}
EOF
docker exec lab-platform-caddy-1 caddy validate --config /etc/caddy/Caddyfile
docker exec lab-platform-caddy-1 caddy reload --config /etc/caddy/Caddyfile

# Hygiène disque : le pull a fait glisser le tag, l'ancienne image est devenue <none>. On retire
# les images orphelines (dangling uniquement) — jamais une image taguée encore servie par un
# conteneur (prod ou preview active). En échec, on n'invalide pas un déploiement réussi.
docker image prune -f >/dev/null 2>&1 || true

echo "✓ déployé : https://${PRIMARY_HOST}  (images ${IMAGES})"
