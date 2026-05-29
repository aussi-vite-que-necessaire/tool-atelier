#!/usr/bin/env bash
# setup-lab-tunnel.sh — déploie sur le lab le serveur wstunnel qui expose le sshd de
# l'hôte au travers d'un WebSocket sur 443. C'est la voie d'accès des sessions dont
# le port 22 sortant est fermé (environnement cloud) : lab-ssh y passe via wss.
#
# Lancé depuis une session où le SSH direct fonctionne (ta machine locale), une seule
# fois. Idempotent : ré-exécutable sans risque.
#
# Pré-requis : LAB_SECRETS_KEY dans l'env (déverrouille le store, fournit la clé SSH).
#
# Garde-fous du serveur : le tunnel ne route que vers host.docker.internal:22 (le
# sshd de l'hôte, rien d'autre) et n'accepte un client que s'il présente le path
# secret sysadmin/WSTUNNEL_PATH. L'authentification réelle reste la clé SSH.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
: "${LAB_SECRETS_KEY:?LAB_SECRETS_KEY requis (déverrouille le store + clé SSH)}"

WSTUNNEL_IMAGE="ghcr.io/erebe/wstunnel:v10.5.4"
APPDIR="/opt/lab/platform/wstunnel"
HOST_NAME="ops.contentos.ch"

# 1. Secret de path (get-or-create dans le scope sysadmin). Versionné chiffré dans le
#    dépôt : les sessions cloud le lisent via lab-secret pour construire le ProxyCommand.
wspath="$("$ROOT/bin/lab-secret" get sysadmin WSTUNNEL_PATH 2>/dev/null || true)"
if [ -z "$wspath" ]; then
  wspath="$(openssl rand -hex 24)"
  printf '%s' "$wspath" | "$ROOT/bin/lab-secret" set sysadmin WSTUNNEL_PATH
  echo "→ secret sysadmin/WSTUNNEL_PATH créé (committé sur la branche courante)"
fi

# 2. Compose du serveur wstunnel sur le réseau lab. extra_hosts résout
#    host.docker.internal vers la passerelle de l'hôte → joint le sshd de l'hôte.
"$ROOT/bin/lab-ssh" "mkdir -p $APPDIR"
"$ROOT/bin/lab-ssh" "cat > $APPDIR/compose.yml" <<YAML
services:
  wstunnel:
    image: $WSTUNNEL_IMAGE
    restart: unless-stopped
    command:
      - /home/app/wstunnel
      - server
      - ws://[::]:8080
      - --restrict-to
      - host.docker.internal:22
      - --restrict-http-upgrade-path-prefix
      - \${WSTUNNEL_PATH}
    extra_hosts:
      - "host.docker.internal:host-gateway"
    networks: [lab]
networks:
  lab:
    external: true
YAML

"$ROOT/bin/lab-ssh" "umask 077; printf 'WSTUNNEL_PATH=%s\n' '$wspath' > $APPDIR/.env"
"$ROOT/bin/lab-ssh" "cd $APPDIR && docker compose -p lab-tunnel --env-file .env -f compose.yml up -d"

# 3. Route Caddy : Caddy termine le TLS (cert wildcard) et passe le WebSocket au
#    conteneur. Le sous-domaine est couvert par le wildcard *.contentos.ch (zéro DNS).
"$ROOT/bin/lab-ssh" "cat > /opt/lab/platform/sites/wstunnel.caddy" <<CADDY
$HOST_NAME {
	reverse_proxy wstunnel:8080
}
CADDY
"$ROOT/bin/lab-ssh" "docker exec lab-platform-caddy-1 caddy validate --config /etc/caddy/Caddyfile"
"$ROOT/bin/lab-ssh" "docker exec lab-platform-caddy-1 caddy reload --config /etc/caddy/Caddyfile"

echo "✓ serveur wstunnel déployé : wss://$HOST_NAME (path secret dans sysadmin/WSTUNNEL_PATH)"
echo "  test depuis une session cloud : bin/lab-ssh \"echo ok && df -h\""
