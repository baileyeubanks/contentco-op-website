#!/usr/bin/env bash
# Repair the Content Co-Op /brief email transport on the M4 ("Blaze") runtime.
#
# Run ON the M4 as an admin user (Bailey). It never prints secrets.
#
#   bash apps/home/scripts/m4-fix-intake-email.sh                # Gmail token copy, if present
#   RESEND_API_KEY=re_xxx bash apps/home/scripts/m4-fix-intake-email.sh   # or Resend
#   CCO_ADMIN_ALERT_EMAILS=baileyeubanks@gmail.com GEMINI_API_KEY=... bash ...
#
# What it does
#   1. Finds the live runtime env file:
#        /Users/_mxappservice/.contentco-op/home-runtime/current/apps/home/.env.local
#   2. If RESEND_API_KEY is given, writes it there (idempotent upsert).
#      Otherwise copies Bailey's Gmail OAuth token to the runtime user's home
#      so the python Gmail path stops failing with FileNotFoundError.
#   3. Upserts CCO_ADMIN_ALERT_EMAILS and GEMINI_API_KEY when provided.
#   4. Restarts the launchd runtime and verifies /api/health reports a transport.
#
# Background: every notification_log row since 2026-08-22 is `failed` with
# "No such file or directory: /Users/_mxappservice/.config/blaze/..." because
# the runtime user has no token file and RESEND_API_KEY is unset.

set -euo pipefail

RUNTIME_USER="${CCO_RUNTIME_USER:-_mxappservice}"
RUNTIME_HOME="/Users/${RUNTIME_USER}/.contentco-op/home-runtime"
ENV_FILE="${RUNTIME_HOME}/current/apps/home/.env.local"
TOKEN_SRC="${GMAIL_TOKEN_SOURCE:-$HOME/.config/blaze/google/blaze_contentcoop.json}"
TOKEN_DST_DIR="/Users/${RUNTIME_USER}/.config/blaze/google"
TOKEN_DST="${TOKEN_DST_DIR}/blaze_contentcoop.json"

log() { printf '[m4-fix-intake-email] %s\n' "$*"; }
fail() { printf '[m4-fix-intake-email] ERROR: %s\n' "$*" >&2; exit 1; }

as_runtime_user() {
  if [ "$(id -un)" = "$RUNTIME_USER" ]; then "$@"; else sudo -u "$RUNTIME_USER" "$@"; fi
}

upsert_env() {
  local key="$1" value="$2"
  [ -n "$value" ] || return 0
  local tmp
  tmp="$(mktemp)"
  if as_runtime_user test -f "$ENV_FILE"; then
    as_runtime_user grep -v "^${key}=" "$ENV_FILE" > "$tmp" || true
  fi
  printf '%s=%s\n' "$key" "$value" >> "$tmp"
  # The temp file is mode 600 and owned by the invoking admin, so copy it as
  # root and hand ownership to the runtime user instead of copying as that user.
  as_runtime_user mkdir -p "$(dirname "$ENV_FILE")"
  sudo cp "$tmp" "$ENV_FILE"
  sudo chown "$RUNTIME_USER" "$ENV_FILE"
  sudo chmod 600 "$ENV_FILE"
  rm -f "$tmp"
  log "set ${key} in runtime .env.local"
}

[ "$(uname -s)" = "Darwin" ] || fail "this script is for the M4 macOS runtime host"
as_runtime_user test -d "$RUNTIME_HOME/current" || fail "runtime not found at $RUNTIME_HOME/current (is this Blaze?)"

if [ -n "${RESEND_API_KEY:-}" ]; then
  upsert_env RESEND_API_KEY "$RESEND_API_KEY"
  TRANSPORT="resend"
elif [ -f "$TOKEN_SRC" ]; then
  as_runtime_user mkdir -p "$TOKEN_DST_DIR"
  sudo cp "$TOKEN_SRC" "$TOKEN_DST"
  sudo chown "$RUNTIME_USER" "$TOKEN_DST"
  sudo chmod 600 "$TOKEN_DST"
  log "copied Gmail OAuth token to ${TOKEN_DST} (owner ${RUNTIME_USER}, mode 600)"
  TRANSPORT="gmail_oauth"
else
  fail "no RESEND_API_KEY given and no Gmail token at ${TOKEN_SRC}. Pass RESEND_API_KEY=... or GMAIL_TOKEN_SOURCE=/path/to/token.json"
fi

upsert_env CCO_ADMIN_ALERT_EMAILS "${CCO_ADMIN_ALERT_EMAILS:-}"
upsert_env GEMINI_API_KEY "${GEMINI_API_KEY:-}"

log "restarting ai.contentcoop.home-runtime"
RUNTIME_UID="$(id -u "$RUNTIME_USER")"
sudo launchctl kickstart -k "gui/${RUNTIME_UID}/ai.contentcoop.home-runtime"

log "waiting for /api/health"
for _ in $(seq 1 45); do
  if curl -fsS --max-time 5 "http://127.0.0.1:4100/api/health?scope=local" > /tmp/cco-intake-health.json 2>/dev/null; then
    python3 - "$TRANSPORT" <<'PY'
import json, sys
body = json.load(open("/tmp/cco-intake-health.json"))
check = next((c for c in body.get("checks", []) if c.get("id") == "intake_contract"), None)
if not check:
    print("[m4-fix-intake-email] WARN: intake_contract check not present (runtime predates this PR?)")
    sys.exit(0)
meta = check.get("meta") or {}
print(f"[m4-fix-intake-email] intake_contract={check.get('status')} emailTransport={meta.get('emailTransport')} ready={meta.get('emailTransportReady')}")
sys.exit(0 if meta.get("emailTransportReady") else 2)
PY
    rc=$?
    if [ "$rc" = "0" ]; then
      log "done. Submit a test brief with a +test address and check notification_log for status=sent."
      exit 0
    fi
    fail "runtime is up but reports no email transport; check the env file and token path"
  fi
  sleep 2
done
fail "runtime did not answer /api/health within 90s; inspect ${RUNTIME_HOME}/logs"
