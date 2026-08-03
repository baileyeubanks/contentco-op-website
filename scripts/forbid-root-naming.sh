#!/usr/bin/env bash
# Fail if forbidden ROOT / Mission Control product naming reappears in CCO surfaces.
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

# Intentional mentions: canon tombstones, permanent redirects, this script
ALLOW='RETIRED_ROOT|CCO_PRODUCT_CANON|forbid-root-naming|legacy-root-redirects|ops:forbid-root|next\.config\.ts|README\.md|AGENTS\.md|are dead|permanently redirect|destination: "/os'

HITS=$(rg -n --hidden \
  -g '!**/node_modules/**' -g '!**/.next/**' -g '!**/public/**' \
  -g '!**/ops/reports/**' -g '!**/.git/**' -g '!**/wiki/**' \
  -e 'Mission Control' -e '/api/root' -e 'CCO_ROOT' -e 'root-operator' -e '@/app/root' \
  -e 'lib/root-' -e 'app/root/' \
  apps/home/app apps/home/lib packages scripts 2>/dev/null \
  | grep -Ev "$ALLOW" || true)

HITS2=$(rg -n --hidden \
  -g '!**/node_modules/**' -g '!**/.next/**' -g '!**/public/**' \
  -g 'apps/home/app/**/*.{ts,tsx}' -g 'apps/home/lib/**/*.{ts,tsx}' \
  -g 'packages/**/*.{ts,tsx}' \
  -e '\bROOT\b' 2>/dev/null \
  | grep -Ev "$ALLOW|:root" || true)

if [ -n "${HITS}${HITS2}" ]; then
  echo "FORBIDDEN ROOT / Mission Control naming found:"
  printf '%s\n%s\n' "$HITS" "$HITS2"
  exit 1
fi
echo "ops:forbid-root OK"
