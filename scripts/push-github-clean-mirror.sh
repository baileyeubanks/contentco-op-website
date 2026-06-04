#!/usr/bin/env bash
set -euo pipefail

repo="${GITHUB_REPO:-baileyeubanks/contentco-op-website}"
github_remote="${GITHUB_REMOTE:-github}"
branch="${PUBLISH_BRANCH:-main}"

bash scripts/audit-github-push-blockers.sh

sha="$(git rev-parse HEAD)"
git fetch "$github_remote" "$branch" >/dev/null 2>&1 || true
github_ref="${github_remote}/${branch}"

printf 'Pushing %s to %s/%s (%s)\n' "${sha:0:12}" "$github_remote" "$branch" "$repo"
if git rev-parse --verify --quiet "$github_ref" >/dev/null &&
  ! git merge-base --is-ancestor "$github_ref" HEAD; then
  if [ "${ALLOW_GITHUB_FORCE_WITH_LEASE:-0}" != "1" ]; then
    printf 'Refusing non-fast-forward GitHub mirror push. Re-run with ALLOW_GITHUB_FORCE_WITH_LEASE=1 only for an intentional mirror repair.\n' >&2
    exit 1
  fi

  github_sha="$(git rev-parse "$github_ref")"
  printf 'Repairing divergent GitHub mirror with --force-with-lease=refs/heads/%s:%s\n' "$branch" "$github_sha"
  git push --force-with-lease="refs/heads/${branch}:${github_sha}" "$github_remote" "HEAD:refs/heads/${branch}"
else
  git push "$github_remote" "HEAD:refs/heads/${branch}"
fi

gh run list --repo "$repo" --branch "$branch" --limit 10
