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

PROJ="$1"; ENV="$2"; IMAGES="$3"
APPDIR="/opt/lab/apps/${PROJ}-${ENV}"
UPSTREAM="${PROJ}-${ENV}"
if [ "$ENV" = "prod" ]; then HOST="${PROJ}.lab.avqn.ch"; else HOST="${PROJ}-${ENV}.lab.avqn.ch"; fi

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
for ref in "${REFS[@]}"; do docker pull "$ref"; done

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
DB=false; REDIS=false; EMAIL=false; BROWSER=false; MIGRATE=""; SEED=""; DOMAIN=""
if [ -f "$APPDIR/lab.json" ]; then
  DB="$(jq -r '.db // false' "$APPDIR/lab.json")"
  REDIS="$(jq -r '.redis // false' "$APPDIR/lab.json")"
  EMAIL="$(jq -r '.email // false' "$APPDIR/lab.json")"
  BROWSER="$(jq -r '.browser // false' "$APPDIR/lab.json")"
  MIGRATE="$(jq -r '.migrate // empty' "$APPDIR/lab.json")"
  SEED="$(jq -r '.seed // empty' "$APPDIR/lab.json")"
  DOMAIN="$(jq -r '.domain // empty' "$APPDIR/lab.json")"
fi

# Postgres central : base <projet>_<env> + DATABASE_URL injecté
if [ "$DB" = "true" ]; then
  # shellcheck disable=SC1091
  . /opt/lab/platform/.env   # LAB_POSTGRES_PASSWORD
  DBNAME="${PROJ}_$(printf '%s' "$ENV" | tr '-' '_')"
  docker exec lab-platform-postgres-1 psql -U postgres -tAc \
    "SELECT 1 FROM pg_database WHERE datname='${DBNAME}'" | grep -q 1 \
    || docker exec lab-platform-postgres-1 createdb -U postgres "${DBNAME}"
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

# Origine publique injectée dans APP_URL. Par défaut = host déployé (juste pour les previews
# et la prod lab par défaut). En prod, si lab.json déclare "domain" (domaine public custom dont
# le DNS pointe vers le lab), l'identité publique est ce domaine. Écrite APRÈS les secrets pour
# être autoritative — en --env-file la dernière occurrence d'une clé gagne.
APP_ORIGIN="https://${HOST}"
if [ "$ENV" = "prod" ] && [ -n "$DOMAIN" ]; then APP_ORIGIN="https://${DOMAIN}"; fi
printf 'APP_URL=%s\n' "$APP_ORIGIN" >> "$APPDIR/.env"

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
${HOST} {
	reverse_proxy ${UPSTREAM}:8080
}
EOF
docker exec lab-platform-caddy-1 caddy validate --config /etc/caddy/Caddyfile
docker exec lab-platform-caddy-1 caddy reload --config /etc/caddy/Caddyfile

# Hygiène disque : le pull a fait glisser le tag, l'ancienne image est devenue <none>. On retire
# les images orphelines (dangling uniquement) — jamais une image taguée encore servie par un
# conteneur (prod ou preview active). En échec, on n'invalide pas un déploiement réussi.
docker image prune -f >/dev/null 2>&1 || true

echo "✓ déployé : https://${HOST}  (images ${IMAGES})"
