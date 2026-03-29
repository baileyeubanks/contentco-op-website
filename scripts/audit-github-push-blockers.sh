#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WARN_MB="${WARN_MB:-50}"
BLOCK_MB="${BLOCK_MB:-100}"

python3 - "${ROOT_DIR}" "${WARN_MB}" "${BLOCK_MB}" <<'PY'
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path


repo = Path(sys.argv[1]).resolve()
warn_bytes = int(sys.argv[2]) * 1024 * 1024
block_bytes = int(sys.argv[3]) * 1024 * 1024


def run(args: list[str]) -> str:
    return subprocess.check_output(args, cwd=repo, text=True)


def human(size: int) -> str:
    return f"{size / (1024 * 1024):.1f} MB"


current_tree: list[dict[str, object]] = []
for raw in run(["git", "ls-tree", "-r", "-l", "HEAD"]).splitlines():
    parts = raw.split(None, 4)
    if len(parts) != 5:
        continue
    _mode, _type, sha, size_raw, path = parts
    if size_raw == "-":
        continue
    size = int(size_raw)
    if size < warn_bytes:
        continue
    current_tree.append(
        {
            "path": path,
            "size_bytes": size,
            "size_human": human(size),
            "sha": sha,
            "blocked": size >= block_bytes,
        }
    )


history_lines = subprocess.check_output(
    "git rev-list --objects --all | git cat-file --batch-check='%(objectname) %(objecttype) %(objectsize) %(rest)'",
    cwd=repo,
    shell=True,
    text=True,
).splitlines()

history_blockers: list[dict[str, object]] = []
seen_paths: set[str] = set()
for raw in history_lines:
    parts = raw.split(" ", 3)
    if len(parts) != 4:
        continue
    sha, object_type, size_raw, path = parts
    if object_type != "blob" or not path:
        continue
    size = int(size_raw)
    if size < block_bytes or path in seen_paths:
        continue
    seen_paths.add(path)
    history_blockers.append(
        {
            "path": path,
            "size_bytes": size,
            "size_human": human(size),
            "sha": sha,
        }
    )


payload = {
    "repo": str(repo),
    "warn_threshold_mb": int(sys.argv[2]),
    "block_threshold_mb": int(sys.argv[3]),
    "current_tree_large_files": current_tree,
    "history_blockers": history_blockers,
}

print(json.dumps(payload, indent=2))

if history_blockers:
    raise SystemExit(2)
PY
