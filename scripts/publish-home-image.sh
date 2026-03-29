#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE_NAME="${IMAGE_NAME:-contentco-op-home}"
IMAGE_BASE="${IMAGE_BASE:-ghcr.io/baileyeubanks/${IMAGE_NAME}}"
TRACKING_TAG="${TRACKING_TAG:-main}"
GIT_SHA="$(git -C "${ROOT_DIR}" rev-parse --short=12 HEAD)"
IMMUTABLE_TAG="${IMMUTABLE_TAG:-sha-${GIT_SHA}}"
LOCAL_IMAGE="${IMAGE_NAME}:${IMMUTABLE_TAG}"
GHCR_USERNAME="${GHCR_USERNAME:-${GITHUB_ACTOR:-baileyeubanks}}"
GHCR_TOKEN_VALUE="${GHCR_TOKEN:-${GITHUB_TOKEN:-}}"
TRACKED_MANIFEST_PATH="${ROOT_DIR}/.git-tracked-manifest"

cd "${ROOT_DIR}"

cleanup() {
  rm -f "${TRACKED_MANIFEST_PATH}"
}
trap cleanup EXIT

bash scripts/write-git-tracked-manifest.sh "${TRACKED_MANIFEST_PATH}" >/dev/null

echo "==> Building ${LOCAL_IMAGE}"
docker build -t "${LOCAL_IMAGE}" .

echo "==> Tagging ${LOCAL_IMAGE}"
docker tag "${LOCAL_IMAGE}" "${IMAGE_BASE}:${IMMUTABLE_TAG}"
docker tag "${LOCAL_IMAGE}" "${IMAGE_BASE}:${TRACKING_TAG}"

if [[ "${PUSH_IMAGE:-0}" == "1" ]]; then
  if [[ -z "${GHCR_TOKEN_VALUE}" ]]; then
    echo "ERROR: PUSH_IMAGE=1 but GHCR_TOKEN/GITHUB_TOKEN is not set." >&2
    exit 1
  fi
  echo "==> Logging into ghcr.io as ${GHCR_USERNAME}"
  printf '%s' "${GHCR_TOKEN_VALUE}" | docker login ghcr.io -u "${GHCR_USERNAME}" --password-stdin
  echo "==> Pushing ${IMAGE_BASE}:${IMMUTABLE_TAG}"
  docker push "${IMAGE_BASE}:${IMMUTABLE_TAG}"
  echo "==> Pushing ${IMAGE_BASE}:${TRACKING_TAG}"
  docker push "${IMAGE_BASE}:${TRACKING_TAG}"
fi

cat <<EOF

Image delivery contract
- immutable: ${IMAGE_BASE}:${IMMUTABLE_TAG}
- tracking:  ${IMAGE_BASE}:${TRACKING_TAG}

Preferred live pattern
1. Build and push this image off-NAS.
2. Point Coolify at ${IMAGE_BASE}:${TRACKING_TAG}.
3. Keep the NAS focused on pull, host, and monitor duties instead of source compilation.

EOF
