#!/bin/zsh
set -euo pipefail

APP_DIR="/Users/baileyeubanks/Desktop/Projects/contentco-op/monorepo/apps/home"
MONOREPO_DIR="/Users/baileyeubanks/Desktop/Projects/contentco-op/monorepo"
PORT=4100

cd "$MONOREPO_DIR"
npm run build -w @contentco-op/home

existing_pid=$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)
if [[ -n "$existing_pid" ]]; then
  echo "[home] stopping existing runtime on :$PORT"
  echo "$existing_pid" | xargs kill >/dev/null 2>&1 || true
  sleep 1
fi

echo "[home] starting fresh standalone runtime on :$PORT"
cd "$APP_DIR"
PORT="$PORT" HOST=0.0.0.0 node scripts/start-standalone.mjs
