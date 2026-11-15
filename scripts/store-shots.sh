#!/usr/bin/env bash
# Gera as imagens da Chrome Web Store em docs/store/ a partir da vitrine
# (demo/store/, dados fictícios). Antes: npm run demo (porta 5199).
set -euo pipefail
cd "$(dirname "$0")/.."
CHROME="${CHROME:-/c/Program Files/Google/Chrome/Application/chrome.exe}"
PROFILE="$(mktemp -d)"
shoot() { # nome url largura altura
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --user-data-dir="$PROFILE" --window-size="$3,$4" --virtual-time-budget=6000 \
    --screenshot="$(pwd -W 2>/dev/null || pwd)/docs/store/$1.png" "$2" >/dev/null 2>&1
  echo "docs/store/$1.png"
}
for n in 1 2 3 4 5; do shoot "captura-$n" "http://localhost:5199/store/?shot=$n" 1280 800; done
shoot promo-440x280 "http://localhost:5199/store/?shot=promo" 440 280
rm -rf "$PROFILE"
