#!/usr/bin/env bash
set -euo pipefail

repo="${GITHUB_REPO:-baileyeubanks/contentco-op-website}"
github_remote="${GITHUB_REMOTE:-github}"
live_remote="${LIVE_REMOTE:-origin}"
branch="${PUBLISH_BRANCH:-main}"
allow_dirty="${ALLOW_DIRTY:-0}"
allow_github_force_with_lease="${ALLOW_GITHUB_FORCE_WITH_LEASE:-0}"
github_blob_limit_bytes="${GITHUB_BLOB_LIMIT_BYTES:-104857600}"
fail=0

say() {
  printf '%s\n' "$*"
}

block() {
  say "[FAIL] $*"
  fail=1
}

ok() {
  say "[OK] $*"
}

warn() {
  say "[WARN] $*"
}

indent() {
  sed 's/^/  /'
}

current_branch="$(git symbolic-ref -q --short HEAD || true)"
head_sha="$(git rev-parse HEAD)"

if [ -z "$current_branch" ]; then
  block "checkout is detached at ${head_sha}; create/switch to a named publish branch before committing or pushing"
else
  ok "current branch: ${current_branch}"
fi

if [ -n "$(git status --porcelain)" ]; then
  if [ "$allow_dirty" = "1" ]; then
    warn "working tree is dirty; continuing because ALLOW_DIRTY=1"
  else
    block "working tree is dirty; commit or stash before publishing/mirroring"
  fi
else
  ok "working tree is clean"
fi

if ! gh repo view "$repo" >/dev/null 2>&1; then
  block "GitHub repository is not reachable through gh: ${repo}"
else
  ok "GitHub repository reachable: ${repo}"
fi

for remote in "$github_remote" "$live_remote"; do
  if ! git remote get-url "$remote" >/dev/null 2>&1; then
    block "missing git remote: ${remote}"
  fi
done

for required in \
  ".github/workflows/ci.yml" \
  ".github/workflows/ci-security.yml" \
  ".github/workflows/publish-home-image.yml" \
  "scripts/validate-pwa-assets.mjs" \
  "scripts/write-git-tracked-manifest.sh"
do
  if [ ! -f "$required" ]; then
    block "missing file referenced by GitHub workflows/publish scripts: ${required}"
  else
    ok "required file present: ${required}"
  fi
done

large_github_blobs="$(
  git rev-list --objects HEAD |
    git cat-file --batch-check='%(objecttype) %(objectname) %(objectsize) %(rest)' |
    awk -v limit="$github_blob_limit_bytes" '$1 == "blob" && $3 > limit {
      path = ""
      for (i = 4; i <= NF; i++) {
        path = path (i == 4 ? "" : " ") $i
      }
      printf "%12d  %s  %s\n", $3, $2, path
    }' |
    sort -nr |
    head -20
)"
if [ -n "$large_github_blobs" ]; then
  block "HEAD history contains blobs over GitHub's ${github_blob_limit_bytes}-byte hard limit; mirror push would be rejected"
  say "$large_github_blobs" | indent
else
  ok "no GitHub-blocked blobs found in HEAD history"
fi

if git remote get-url "$github_remote" >/dev/null 2>&1; then
  git fetch "$github_remote" "$branch" >/dev/null 2>&1 || block "could not fetch ${github_remote}/${branch}"
fi
if git remote get-url "$live_remote" >/dev/null 2>&1; then
  git fetch "$live_remote" "$branch" >/dev/null 2>&1 || block "could not fetch ${live_remote}/${branch}"
fi

github_ref="${github_remote}/${branch}"
live_ref="${live_remote}/${branch}"
if git rev-parse --verify --quiet "$github_ref" >/dev/null; then
  github_sha="$(git rev-parse "$github_ref")"
  if git merge-base --is-ancestor "$github_ref" HEAD; then
    ok "GitHub ${branch} can fast-forward from ${github_sha:0:12} to ${head_sha:0:12}"
  elif [ "$allow_github_force_with_lease" = "1" ]; then
    warn "GitHub ${branch} diverged at ${github_sha}; ALLOW_GITHUB_FORCE_WITH_LEASE=1 permits a leased mirror repair"
  else
    block "GitHub ${branch} is not an ancestor of HEAD; a normal push would be rejected"
  fi
else
  warn "GitHub ref not present locally after fetch: ${github_ref}"
fi

if git rev-parse --verify --quiet "$live_ref" >/dev/null; then
  live_sha="$(git rev-parse "$live_ref")"
  if git merge-base --is-ancestor "$live_ref" HEAD; then
    ok "live ${branch} can fast-forward from ${live_sha:0:12} to ${head_sha:0:12}"
  else
    block "live ${branch} is not an ancestor of HEAD; publish would not be a clean fast-forward"
  fi
fi

if [ "$fail" -ne 0 ]; then
  say "GitHub/publish blockers found."
  exit 1
fi

say "No GitHub/publish blockers found for ${head_sha:0:12}."
