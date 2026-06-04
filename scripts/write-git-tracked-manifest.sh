#!/usr/bin/env bash
set -euo pipefail

output="${1:-.git-tracked-manifest}"
mkdir -p "$(dirname "$output")"
git ls-files | LC_ALL=C sort > "$output"
printf 'wrote %s (%s files)\n' "$output" "$(wc -l < "$output" | tr -d ' ')"
