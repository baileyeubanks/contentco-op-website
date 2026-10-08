#!/usr/bin/env python3
"""Prune old CCO home runtime release dirs on the M4.

publish-m4-runtime.mjs pipes this file to `python3 -` over ssh after a
successful swap; prune-m4-releases.mjs pipes it with --dry-run.

Only real release dirs count toward --keep. Entries whose name starts with "."
(for example the hidden `.stage-*` staging dirs, .DS_Store) are skipped
entirely: they never take a keep slot and are never deleted here. Before this
rule, one hidden `.stage-*` dir took a slot, so the 2026-10-08 hotfix publish
deleted 6 release dirs instead of the expected 5.

The full delete list is printed before anything is deleted. With --dry-run,
nothing is deleted.
"""

import argparse
import shutil
import sys
from pathlib import Path


def is_release_dir(path: Path) -> bool:
    return not path.name.startswith(".") and path.is_dir() and not path.is_symlink()


def resolve_protected(releases_dir: Path, value: str) -> Path:
    candidate = Path(value)
    if not candidate.is_absolute():
        candidate = releases_dir.parent / candidate
    return candidate.resolve()


def plan_prune(releases_dir: Path, keep: int, protect, pending: int = 0):
    """Return (kept, deletes) as lists of release dir paths, newest first."""
    releases = [path for path in releases_dir.iterdir() if is_release_dir(path)]
    ordered = sorted(releases, key=lambda path: (path.stat().st_mtime, path.name), reverse=True)
    slots = max(keep - pending, 0)
    protected = {resolve_protected(releases_dir, value) for value in protect if value}
    kept = []
    deletes = []
    for index, path in enumerate(ordered):
        if index < slots or path.resolve() in protected:
            kept.append(path)
        else:
            deletes.append(path)
    return kept, deletes


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("releases_dir")
    parser.add_argument("--keep", type=int, default=8, help="newest real release dirs to keep (default 8)")
    parser.add_argument(
        "--protect",
        action="append",
        default=[],
        help="release dir that is never deleted (the new release, the rollback target); repeatable",
    )
    parser.add_argument(
        "--pending",
        type=int,
        default=0,
        help="releases a coming publish will add (each takes a keep slot); use 1 for a pre-publish dry run",
    )
    parser.add_argument("--dry-run", action="store_true", help="print the plan and delete nothing")
    args = parser.parse_args(argv)

    if args.keep < 1 or args.pending < 0:
        print("[cco-prune] --keep must be >= 1 and --pending >= 0", file=sys.stderr)
        return 2
    releases_dir = Path(args.releases_dir)
    if not releases_dir.is_dir():
        print(f"[cco-prune] no releases dir at {releases_dir}; nothing to prune")
        return 0

    kept, deletes = plan_prune(releases_dir, args.keep, args.protect, args.pending)
    skipped = sorted(path.name for path in releases_dir.iterdir() if path.name.startswith("."))
    mode = "DRY RUN, nothing deleted" if args.dry_run else "deleting"
    print(f"[cco-prune] {mode}: keep={args.keep} pending={args.pending} release_dirs={len(kept) + len(deletes)}")
    print(f"[cco-prune] hidden entries skipped (never counted, never deleted): {len(skipped)}")
    for name in skipped:
        print(f"[cco-prune]   skip {name}")
    print(f"[cco-prune] keep {len(kept)}:")
    for path in kept:
        print(f"[cco-prune]   keep {path.name}")
    print(f"[cco-prune] {'would delete' if args.dry_run else 'delete'} {len(deletes)}:")
    for path in deletes:
        print(f"[cco-prune]   {'would delete' if args.dry_run else 'delete'} {path.name}")
    sys.stdout.flush()

    if args.dry_run:
        return 0
    for path in deletes:
        shutil.rmtree(path, ignore_errors=True)
        if path.exists():
            print(f"[cco-prune]   could not fully delete {path.name}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
