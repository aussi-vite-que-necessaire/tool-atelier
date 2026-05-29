#!/usr/bin/env bash
# Tests de l'outil apercu — l'œil de l'agent (bin/apercu + tools/apercu/shot.mjs).
# Lance: bash test/apercu.test.sh
#
# Le smoke réel (lancer Chromium et screenshoter une vraie page) télécharge le navigateur et
# n'est joué que sur demande explicite (APERCU_E2E=1) — sinon on vérifie la logique sans
# navigateur via --dry-run, dans l'esprit "SKIP si dépendance lourde absente" de l'atelier.
set -uo pipefail
fail() { echo "FAIL: $1" >&2; exit 1; }
ATELIER="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
SHOT="$ATELIER/tools/apercu/shot.mjs"
BIN="$ATELIER/bin/apercu"

command -v node >/dev/null 2>&1 || { echo "SKIP apercu.test.sh (node absent)"; exit 0; }
[ -f "$SHOT" ] || fail "tools/apercu/shot.mjs introuvable"
[ -x "$BIN" ]  || fail "bin/apercu absent ou non exécutable"

# --help documente l'usage sans rien installer.
"$BIN" --help | grep -q "apercu" || fail "bin/apercu --help ne documente pas l'outil"

# --dry-run : résout l'URL, les routes, les viewports et les chemins, sans lancer Chromium.
plan="$(node "$SHOT" http://localhost:3000 --route / --route /reglages --viewport mobile --dry-run)" \
  || fail "shot.mjs --dry-run a échoué"
echo "$plan" | grep -q '"url": "http://localhost:3000"' || fail "dry-run : URL non résolue"
echo "$plan" | grep -q '"route": "/reglages"'          || fail "dry-run : route absente"
echo "$plan" | grep -q 'home-mobile.png'               || fail "dry-run : chemin home/mobile absent"
echo "$plan" | grep -q 'reglages-mobile.png'           || fail "dry-run : chemin reglages/mobile absent"
# Un seul viewport demandé → pas de desktop dans le plan.
echo "$plan" | grep -q 'desktop' && fail "dry-run : desktop présent alors qu'on a demandé mobile seul"

# Viewports par défaut = mobile + desktop.
def="$(node "$SHOT" --dry-run)" || fail "shot.mjs --dry-run (défaut) a échoué"
echo "$def" | grep -q 'home-mobile.png'  || fail "défaut : mobile manquant"
echo "$def" | grep -q 'home-desktop.png' || fail "défaut : desktop manquant"

# Dimensions custom LxH acceptées.
node "$SHOT" --viewport 800x600 --dry-run | grep -q '"width": 800' || fail "viewport LxH non géré"

# Option inconnue → erreur (code ≠ 0).
node "$SHOT" --pas-une-option --dry-run >/dev/null 2>&1 && fail "option inconnue acceptée à tort"

# Smoke réel optionnel : sert un HTML local, capture, vérifie le PNG (magic bytes).
if [ "${APERCU_E2E:-}" = "1" ]; then
  echo "→ smoke e2e (APERCU_E2E=1) : téléchargement Chromium possible…"
  TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"; kill "${srv:-0}" 2>/dev/null' EXIT
  printf '<!doctype html><title>t</title><h1 style="font:48px sans-serif">apercu ok</h1>' > "$TMP/index.html"
  ( cd "$TMP" && python3 -m http.server 8731 >/dev/null 2>&1 ) & srv=$!
  for _ in $(seq 1 20); do curl -sf -o /dev/null http://localhost:8731 && break; sleep 0.3; done
  "$BIN" http://localhost:8731 --route / --viewport mobile --out "$TMP/shots" \
    || fail "bin/apercu n'a pas capturé"
  png="$TMP/shots/home-mobile.png"
  [ -s "$png" ] || fail "PNG non écrit"
  head -c 8 "$png" | grep -q $'\x89PNG' || fail "fichier produit n'est pas un PNG"
  echo "  ✓ smoke e2e : PNG valide"
else
  echo "ℹ smoke e2e ignoré (APERCU_E2E≠1) — logique vérifiée via --dry-run."
fi

echo "OK apercu.test.sh"
