#!/usr/bin/env bash
# Runs npm test the same way everywhere, for the agents and for people.
# Claude's cloud machines come with a browser in /opt/pw-browsers, often a newer build than the one this project's
# Playwright asks for, and downloading the right one there is slow or blocked. So when that folder exists, this links
# its headless browser into a temporary folder under the name and layout Playwright expects, and points Playwright at
# it. Nothing in the repo changes. Anywhere else (CI, a laptop) it installs the browser the usual way.
#   bash scripts/run-tests.sh
set -euo pipefail
cd "$(dirname "$0")/.."
[ -d node_modules/playwright-core ] || npm ci
src=$(ls -d /opt/pw-browsers/chromium_headless_shell-* 2>/dev/null | sort -V | tail -1 || true)
if [ -z "${PLAYWRIGHT_BROWSERS_PATH:-}" ] && [ -n "$src" ]; then
  rev=$(node -e 'console.log(require("./node_modules/playwright-core/browsers.json").browsers.find((b) => b.name === "chromium-headless-shell").revision)')
  exe=$(find "$src" -maxdepth 2 -type f \( -name headless_shell -o -name chrome-headless-shell \) | head -1)
  dir=$(mktemp -d)
  # Older and newer Playwright versions look in different places, so make both
  for layout in chrome-linux/headless_shell chrome-headless-shell-linux64/chrome-headless-shell; do
    d="$dir/chromium_headless_shell-$rev/${layout%/*}"
    mkdir -p "$d"
    ln -s "$(dirname "$exe")"/* "$d/"
    [ -e "$d/${layout#*/}" ] || ln -s "$(basename "$exe")" "$d/${layout#*/}"
  done
  touch "$dir/chromium_headless_shell-$rev/INSTALLATION_COMPLETE"
  export PLAYWRIGHT_BROWSERS_PATH="$dir"
  echo "Using the browser already on this machine ($src)"
else
  npx playwright install --with-deps chromium
fi
npm test
