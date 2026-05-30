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

# Hash scrypt BetterAuth du mot de passe 'password' (même que scripts/seed-preview.mjs) — le scrub
# le pose sur l'opérateur cloné pour le rendre connectable via /preview-login.
PREVIEW_PASSWORD_HASH='0123456789abcdef0123456789abcdef:f7c278f7f739ad5077f0a82b9a3d67831a7d1b05bc7b8e41fd9d55eb65c87a3f51cefaa870eda509939a162697e744990e3143cfc78ed746f2f981bb61c569e2'

# Mode de provisioning des données par env (fonction pure) : prod = aucun ; integration = clone
# complet de la prod (gardé par basic-auth) ; toute autre branche = clone scrubbé (anonymisé).
provision_mode() {
  case "$1" in
    prod) echo "none" ;;
    integration) echo "clone-full" ;;
    *) echo "clone-scrub" ;;
  esac
}

# Nom de base <proj>_<env> (env-underscored), borné à 63 car. (limite d'identifiant Postgres) :
# au-delà on tronque à 52 et on suffixe par un hash cksum déterministe (≤10 chiffres → ≤63),
# évitant les collisions muettes.
db_name() {
  local name; name="${1}_$(printf '%s' "$2" | tr '-' '_')"
  if [ "${#name}" -le 63 ]; then printf '%s' "$name"
  else printf '%s_%s' "$(printf '%s' "$name" | cut -c1-52)" "$(printf '%s' "$name" | cksum | cut -d' ' -f1)"; fi
}

# SQL de scrub d'un clone de prod (previews par-branche) : retire toute donnée réelle exploitable
# (tokens sociaux, tokens OAuth d'auth, hashes de mots de passe, identités), vide les sessions et
# jetons de vérification, et donne au 1er opérateur l'identité preview connue (op@contentos.test /
# mot de passe 'password') pour que /preview-login fonctionne.
scrub_sql() {
  cat <<SQL
-- Tokens de publication sociale neutralisés ; comptes anonymisés et expirés.
UPDATE social_accounts SET access_token = 'scrubbed', external_id = 'scrubbed', display_name = 'Compte de démo', expires_at = now() - interval '1 day';
-- Comptes d'auth : aucun token OAuth résiduel, aucun hash de mot de passe réel ne survit au clone.
UPDATE account SET access_token = NULL, refresh_token = NULL, id_token = NULL, scope = NULL, password = NULL;
-- Sessions et jetons de vérification : vidés.
DELETE FROM session;
DELETE FROM verification;
-- Emails et noms anonymisés.
UPDATE "user" SET email = 'op+' || id || '@contentos.test', name = 'Opérateur ' || left(id, 6);
-- 1er opérateur = identité preview connue, connectable via /preview-login.
UPDATE "user" SET email = 'op@contentos.test', name = 'Opérateur 1'
  WHERE id = (SELECT id FROM "user" WHERE role = 'operator' ORDER BY created_at, id LIMIT 1);
UPDATE account SET password = '${PREVIEW_PASSWORD_HASH}'
  WHERE provider_id = 'credential'
    AND user_id = (SELECT id FROM "user" WHERE email = 'op@contentos.test');
SQL
}

# Contenu d'un fichier de site Caddy (fonction pure). basic = "user hash" non vide → route protégée
# (clone complet de la prod en integration : jamais public).
caddy_site() {
  local hosts="$1" upstream="$2" basic="${3:-}"
  if [ -n "$basic" ]; then
    printf '%s {\n\tbasic_auth {\n\t\t%s\n\t}\n\treverse_proxy %s:8080\n}\n' "$hosts" "$basic" "$upstream"
  else
    printf '%s {\n\treverse_proxy %s:8080\n}\n' "$hosts" "$upstream"
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

# Mode de provisioning + base cible. Initialisés même si db:false (set -u).
PROVISION="$(provision_mode "$ENV")"; CLONED=0; DBNAME=""

# Postgres central : DATABASE_URL injecté (rôle applicatif `app`, jamais superuser).
#   db:true            → base <projet>_<env>. Hors prod : clonée depuis la prod (complète en
#                        integration, scrubbée en preview par-branche) si la prod porte des données,
#                        sinon créée vide + seed. En prod : créée si absente, jamais clonée.
#   db:{shared:"X"}    → réutilise la base X_<env> d'un autre projet (backend partagé).
if [ "$DB" = "true" ] || [ "$DB" = "shared" ]; then
  # shellcheck disable=SC1091
  . /opt/lab/platform/.env   # LAB_POSTGRES_PASSWORD, LAB_APP_DB_PASSWORD
  APP_DB_PASSWORD="${LAB_APP_DB_PASSWORD:-$LAB_POSTGRES_PASSWORD}"
  PG="docker exec lab-platform-postgres-1 psql -U postgres"
  # Rôle applicatif least-privilege (l'app ne se connecte jamais en superuser).
  $PG -tAc "SELECT 1 FROM pg_roles WHERE rolname='app'" | grep -q 1 \
    || $PG -c "CREATE ROLE app LOGIN PASSWORD '$APP_DB_PASSWORD'" >/dev/null
  if [ "$DB" = "shared" ]; then
    [ -n "$DB_SHARED_FROM" ] || { echo "::error::db.shared vide dans lab.json"; exit 1; }
    DBNAME="$(db_name "$DB_SHARED_FROM" "$ENV")"
  else
    DBNAME="$(db_name "$PROJ" "$ENV")"
    SRC="$(db_name "$PROJ" prod)"
    if [ "$PROVISION" != "none" ] \
       && $PG -tAc "SELECT 1 FROM pg_database WHERE datname='$SRC'" | grep -q 1 \
       && [ "$($PG -d "$SRC" -tAc 'SELECT count(*) FROM "user"' 2>/dev/null || echo 0)" != "0" ]; then
      # Clone de la prod (même serveur → interne, instantané). Restauré EN TANT QUE `app`
      # (--no-owner) → tous les objets (schémas drizzle/public, tables) appartiennent à `app`,
      # pour que les migrations DDL passent ensuite en rôle app (REASSIGN OWNED BY postgres est
      # interdit : objets « required by the database system »).
      # --force : termine les connexions ouvertes (re-deploy d'une preview dont les conteneurs
      # tournent encore) au lieu d'échouer sur « database is being accessed by other users ».
      docker exec lab-platform-postgres-1 dropdb -U postgres --force --if-exists "$DBNAME"
      docker exec lab-platform-postgres-1 createdb -U postgres -O app "$DBNAME"
      # bash + pipefail + ON_ERROR_STOP : un échec de pg_dump OU une erreur de restore fait sortir
      # le pipe en non-zéro → `set -e` arrête le deploy. Sans ça, psql sort en 0 sur un flux tronqué
      # et l'app démarrerait silencieusement sur une base à moitié clonée.
      docker exec -e PGPASSWORD="$APP_DB_PASSWORD" lab-platform-postgres-1 bash -c \
        "set -o pipefail; pg_dump -U postgres --no-owner '$SRC' | psql -U app -h 127.0.0.1 -v ON_ERROR_STOP=1 -q -d '$DBNAME'"
      CLONED=1
      echo "✓ base $DBNAME clonée depuis $SRC ($PROVISION)"
    else
      $PG -tAc "SELECT 1 FROM pg_database WHERE datname='$DBNAME'" | grep -q 1 \
        || docker exec lab-platform-postgres-1 createdb -U postgres -O app "$DBNAME"
    fi
    # L'app possède sa base (requis pour les migrations DDL en rôle app). Idempotent.
    $PG -c "ALTER DATABASE \"$DBNAME\" OWNER TO app" >/dev/null 2>&1 || true
  fi
  printf 'DATABASE_URL=postgres://app:%s@postgres:5432/%s\n' "$APP_DB_PASSWORD" "$DBNAME" >> "$APPDIR/.env"
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

# Hors prod : neutralise la publication LinkedIn réelle. Les tokens (clonés depuis la prod en
# integration) restent présents mais inertes — aucune publication ne part vers le vrai LinkedIn.
if [ "$ENV" != "prod" ]; then
  printf 'CONTENT_OS_LINKEDIN_STUB=1\n' >> "$APPDIR/.env"
fi

# Migrations (toujours) — conteneur one-shot. Sur un clone, applique les migrations plus récentes
# que la prod ; sur une base vide, monte le schéma complet.
if [ -n "$MIGRATE" ]; then
  docker run --rm --network lab --env-file "$APPDIR/.env" "$MIGRATE_IMAGE" sh -c "$MIGRATE"
fi
# Données : clone de prod → scrub (branches) ou rien (integration = clone complet) ; sinon seed
# synthétique (bootstrap, prod vide/absente, hors prod).
if [ "$PROVISION" = "clone-scrub" ] && [ "$CLONED" = "1" ]; then
  scrub_sql | docker exec -i lab-platform-postgres-1 psql -U postgres -q -d "$DBNAME"
  echo "✓ clone scrubbé ($DBNAME)"
elif [ "$CLONED" != "1" ] && [ -n "$SEED" ] && [ "$ENV" != "prod" ]; then
  docker run --rm --network lab --env-file "$APPDIR/.env" "$MIGRATE_IMAGE" sh -c "$SEED"
fi

# --force-recreate : applique les changements de .env (secrets) même quand l'image est identique
# (sinon une rotation de secret seule ne serait pas prise en compte).
docker compose -p "${PROJ}-${ENV}" --env-file "$APPDIR/.env" -f "$APPDIR/compose.yml" up -d --force-recreate

# Smoke post-deploy : l'app doit répondre 200 sur /healthz (sonde sans DB) avant qu'on déclare le
# déploiement bon. Joint le conteneur web par son alias réseau ${UPSTREAM} (exactement ce que Caddy
# proxie), via un busybox jetable sur le réseau lab — aucune dépendance à l'image applicative ni au
# DNS public. Échec après ~60s → le deploy échoue plutôt que d'exposer une app qui crash au boot.
if ! docker run --rm --network lab busybox sh -c \
  'for i in $(seq 1 30); do wget -q -T 3 -O /dev/null "http://'"$UPSTREAM"':8080/healthz" && exit 0; sleep 2; done; exit 1'; then
  echo "::error::healthz KO après ~60s (http://${UPSTREAM}:8080/healthz) — l'app n'a pas démarré" >&2
  docker compose -p "${PROJ}-${ENV}" --env-file "$APPDIR/.env" -f "$APPDIR/compose.yml" logs --tail 50 app >&2 || true
  exit 1
fi
echo "✓ healthz OK ($UPSTREAM)"

mkdir -p /opt/lab/platform/sites
# Integration = clone complet de la prod → route protégée par basic-auth (jamais publique).
BASIC=""
if [ "$ENV" = "integration" ]; then
  # shellcheck disable=SC1091
  [ -f /opt/lab/platform/.env ] && . /opt/lab/platform/.env
  BASIC="${LAB_INTEGRATION_BASICAUTH:-}"
fi
caddy_site "$HOSTS_CADDY" "$UPSTREAM" "$BASIC" > "/opt/lab/platform/sites/${PROJ}-${ENV}.caddy"
docker exec lab-platform-caddy-1 caddy validate --config /etc/caddy/Caddyfile
docker exec lab-platform-caddy-1 caddy reload --config /etc/caddy/Caddyfile

# Hygiène disque : le pull a fait glisser le tag, l'ancienne image est devenue <none>. On retire
# les images orphelines (dangling uniquement) — jamais une image taguée encore servie par un
# conteneur (prod ou preview active). En échec, on n'invalide pas un déploiement réussi.
docker image prune -f >/dev/null 2>&1 || true

echo "✓ déployé : https://${PRIMARY_HOST}  (images ${IMAGES})"
