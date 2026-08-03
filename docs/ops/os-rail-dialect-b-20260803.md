# CCO OS Dialect B rail — publish receipt (2026-08-03)

## Ship

| Field | Value |
| --- | --- |
| Commit | `c62c6a503a2787ab97cff7fb7cd06b3d34760a1b` |
| Branch | `cursor/fix-os-rail-dialect-b` → `origin/main` |
| Runtime | Blaze `~/.contentco-op/home-runtime/releases/c62c6a503a27` |
| Proof | `https://admin.contentco-op.com/api/runtime-proof` build_id === HEAD |

## Cleared (live)

- Dark operator overview/system heroes → light Sapphire canvas `#F7F9FC` / white panels / 12px radii
- Atlantis primary CTAs → `#0057FF` on `[data-os-brand=cc]` (`--at-primary`)
- Contacts Stewarded KPI **2567** matches Overview "Contacts in play" (scope=`ALL` no longer collapsed to host default `CC`)
- Mobile overview `scrollWidth === 375` (sidebar auto-collapse ≤720px)
- `root-empty-state` renamed `os-empty-state`

## Residual

- Usability ≥8 still open: `/os/dispatch` off-rail + fetch fail
- ACS/CCO contact facet counts often 0 when `business_unit` is null in CCO-DB (Stewarded total is authoritative)
- Quotes `+ New Quote` may render as unfilled link chrome (not green; not blocking)

## Trap / countermeasure

`publish:m4` flipped `current` to the new release while an orphan `next-server` kept serving the prior release cwd (`b0b8f520…`). `launchctl kickstart` failed with EADDRINUSE; `/api/runtime-proof` reported the new SHA from the symlink/env while CSS/JS stayed old.

**Countermeasure:** after every publish, assert the :4100 listener cwd equals `current/apps/home` (not build_id alone). If kickstart fails, kill the orphan listener then bootstrap/kickstart `gui/$(id -u)/ai.contentcoop.home-runtime`.

## Evidence

`~/.claude/plans/cco-os-rail-dialect-b-evidence/` (screenshots + `verify.json`). Password never written.
