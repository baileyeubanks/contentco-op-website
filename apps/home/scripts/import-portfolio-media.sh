#!/bin/zsh
set -euo pipefail

ROOT="/Users/baileyeubanks/Desktop/Projects/contentco-op/monorepo/apps/home"
OUT_DIR="$ROOT/public/cc/portfolio-cdn"
FFMPEG_BIN="${FFMPEG_BIN:-/opt/homebrew/bin/ffmpeg}"
FFPROBE_BIN="${FFPROBE_BIN:-/opt/homebrew/bin/ffprobe}"

if [[ ! -x "$FFMPEG_BIN" || ! -x "$FFPROBE_BIN" ]]; then
  echo "[portfolio-import] ffmpeg/ffprobe not found"
  exit 1
fi

mkdir -p "$OUT_DIR"

get_duration_seconds() {
  "$FFPROBE_BIN" -v error -show_entries format=duration -of default=nw=1:nk=1 "$1" | awk '{print int($1)}'
}

make_web_video() {
  local source="$1"
  local target="$2"

  "$FFMPEG_BIN" -y -i "$source" \
    -vf "scale='if(gt(iw,1920),1920,iw)':-2:flags=lanczos" \
    -c:v libx264 -preset slow -crf 21 \
    -pix_fmt yuv420p \
    -movflags +faststart \
    -c:a aac -b:a 192k \
    "$target"
}

make_thumbnail() {
  local source="$1"
  local target="$2"
  local duration="$3"
  local midpoint=8

  if [[ "$duration" -gt 24 ]]; then
    midpoint=$(( duration / 3 ))
  elif [[ "$duration" -gt 12 ]]; then
    midpoint=$(( duration / 2 ))
  fi

  "$FFMPEG_BIN" -y -ss "$midpoint" -i "$source" \
    -frames:v 1 \
    -update 1 \
    -vf "scale=1600:-2:flags=lanczos" \
    "$target"
}

import_asset() {
  local source="$1"
  local target_base="$2"

  if [[ ! -f "$source" ]]; then
    echo "[portfolio-import] missing source: $source"
    return 1
  fi

  local video_target="$OUT_DIR/${target_base}.mp4"
  local thumb_target="$OUT_DIR/thumb_${target_base}.jpg"
  local duration
  duration="$(get_duration_seconds "$source")"

  echo "[portfolio-import] importing $source"
  make_web_video "$source" "$video_target"
  make_thumbnail "$source" "$thumb_target" "$duration"
  echo "[portfolio-import] wrote $video_target"
  echo "[portfolio-import] wrote $thumb_target"
}

# Portfolio shortlist imported from the mounted NAS.
import_asset "/Volumes/CC_NAS/2024/2024.09.22_TAR 'Turn Arounds'/EXPORTS/BP TURN-AROUNDS_FINAL.mp4" "bp_turnarounds_final"
import_asset "/Volumes/CC_NAS/2024/2024.08.27_BP Drops & Red Zone Management/FINALS/RED ZONE MAIN_FINAL.mov" "bp_red_zone_main_final"
import_asset "/Volumes/CC_NAS/2024/2024.11.12_bp LEAH/EXPORTS/WomenInLeadertship_v.3.mp4" "bp_women_in_leadership_v3"
import_asset "/Volumes/CC_NAS/2024/2024.08.09_bp/2024.08.09_bp /DIFFERENTIAL PERFORMANCE_FINAL.mp4" "bp_differential_performance_final"
