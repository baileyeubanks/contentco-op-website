#!/usr/bin/env bash
set -euo pipefail

repo="${GITHUB_REPO:-baileyeubanks/contentco-op-website}"
branch="${PUBLISH_BRANCH:-main}"

bash scripts/audit-github-push-blockers.sh
gh workflow run publish-home-image.yml --repo "$repo" --ref "$branch"
printf 'Triggered Publish CCO Home Image for %s@%s\n' "$repo" "$branch"
