#!/usr/bin/env bash
set -euo pipefail

SRC="${1:-/Users/baileyeubanks/Desktop/CC_PHOTOS/HLSR+bp_30 Sec Spot_FINAL.mp4}"
OUT="${2:-/Users/baileyeubanks/Desktop/contentco-op/apps/home/public/media}"

mkdir -p "$OUT"

ffmpeg -y -i "$SRC" \
  -vf "scale=-2:1080:flags=lanczos,fps=24" \
  -an \
  -c:v libx264 \
  -preset medium \
  -crf 24 \
  -movflags +faststart \
  "$OUT/hero-1080.mp4"

ffmpeg -y -i "$SRC" \
  -vf "scale=-2:1080:flags=lanczos,fps=24" \
  -an \
  -c:v libvpx-vp9 \
  -b:v 0 \
  -crf 33 \
  "$OUT/hero-1080.webm"

ffmpeg -y -ss 00:00:02 -i "$SRC" -frames:v 1 -update 1 \
  -vf "scale=-2:1080:flags=lanczos" \
  "$OUT/hero-poster.jpg"

echo "generated:"
ls -lh "$OUT"/hero-1080.mp4 "$OUT"/hero-1080.webm "$OUT"/hero-poster.jpg

