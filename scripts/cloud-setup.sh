#!/usr/bin/env bash
# cloud-setup.sh — prépare l'environnement cloud (monorepo) : installe le client
# wstunnel (transport de secours pour lab-ssh quand le port 22 sortant est fermé)
# puis les deps de chaque projet Node. Idempotent. À pointer depuis la config de
# l'environnement cloud.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"

# Client wstunnel : lab-ssh l'utilise pour faire transiter le SSH dans un WebSocket
# sur 443 (wss://ops.contentos.ch) quand le port 22 sortant est bloqué. Binaire
# statique vérifié au checksum, posé dans /usr/local/bin. Version épinglée.
WSTUNNEL_VERSION="10.5.4"
install_wstunnel() {
  command -v wstunnel >/dev/null 2>&1 && return 0
  local os arch asset base tmp
  os="$(uname -s | tr '[:upper:]' '[:lower:]')"      # linux / darwin
  case "$(uname -m)" in
    x86_64|amd64) arch=amd64 ;;
    aarch64|arm64) arch=arm64 ;;
    *) echo "wstunnel : architecture non gérée ($(uname -m)), install ignorée" >&2; return 0 ;;
  esac
  asset="wstunnel_${WSTUNNEL_VERSION}_${os}_${arch}.tar.gz"
  base="https://github.com/erebe/wstunnel/releases/download/v${WSTUNNEL_VERSION}"
  tmp="$(mktemp -d)"
  echo "→ wstunnel ${WSTUNNEL_VERSION} ($os/$arch)"
  curl -fsSL "$base/$asset" -o "$tmp/$asset"
  curl -fsSL "$base/checksums.txt" -o "$tmp/checksums.txt"
  ( cd "$tmp" && grep " ${asset}\$" checksums.txt | sha256sum -c - )
  tar -xzf "$tmp/$asset" -C "$tmp" wstunnel
  install -m 0755 "$tmp/wstunnel" /usr/local/bin/wstunnel
  rm -rf "$tmp"
}
install_wstunnel

for dir in "$ROOT"/projects/*/; do
  [ -f "$dir/package.json" ] || continue
  echo "→ deps: $(basename "$dir")"
  ( cd "$dir" && { [ -f package-lock.json ] && npm ci || npm install; } )
done
echo "cloud-setup terminé"
