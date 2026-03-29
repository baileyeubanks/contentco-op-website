#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET_REPO="${TARGET_REPO:-baileyeubanks/contentco-op-website}"
TARGET_BRANCH="${TARGET_BRANCH:-main}"
SOURCE_REF="${SOURCE_REF:-HEAD}"
COMMIT_SHA="$(git -C "${ROOT_DIR}" rev-parse --short=12 "${SOURCE_REF}")"
TMP_DIR="$(mktemp -d)"
PUSH_PROTOCOL="${GITHUB_PUSH_PROTOCOL:-auto}"

cleanup() {
  rm -rf "${TMP_DIR}"
}
trap cleanup EXIT

if ! command -v git >/dev/null 2>&1; then
  echo "ERROR: git is required." >&2
  exit 1
fi

resolve_remote() {
  if [[ "${PUSH_PROTOCOL}" != "ssh" ]] && command -v gh >/dev/null 2>&1; then
    local token
    token="$(gh auth token 2>/dev/null || true)"
    if [[ -n "${token}" ]]; then
      printf 'https://x-access-token:%s@github.com/%s.git' "${token}" "${TARGET_REPO}"
      return 0
    fi
  fi
  printf 'git@github.com:%s.git' "${TARGET_REPO}"
}

echo "==> Exporting ${SOURCE_REF} from ${ROOT_DIR}"
git -C "${ROOT_DIR}" archive "${SOURCE_REF}" | tar -xf - -C "${TMP_DIR}"

pushd "${TMP_DIR}" >/dev/null
git init -b "${TARGET_BRANCH}" >/dev/null
git config user.name "${GIT_AUTHOR_NAME:-Codex Mirror}"
git config user.email "${GIT_AUTHOR_EMAIL:-codex@contentco-op.local}"
git add .
git commit -m "Mirror ${TARGET_BRANCH} from ${COMMIT_SHA}" >/dev/null
git remote add origin "$(resolve_remote)"

echo "==> Force pushing clean mirror to ${TARGET_REPO}:${TARGET_BRANCH}"
git push --force origin "${TARGET_BRANCH}:${TARGET_BRANCH}"
popd >/dev/null

cat <<EOF

GitHub clean mirror updated
- repo:   ${TARGET_REPO}
- branch: ${TARGET_BRANCH}
- source: ${SOURCE_REF} (${COMMIT_SHA})

This push contains only the current tracked tree and avoids historical large-blob blockers.
EOF
