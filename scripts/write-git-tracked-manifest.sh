#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MANIFEST_PATH="${1:-${ROOT_DIR}/.git-tracked-manifest}"

git -C "${ROOT_DIR}" ls-files > "${MANIFEST_PATH}"
echo "${MANIFEST_PATH}"
