# ROOT/MC nuke proof — 2026-08-01

## Code (local) — DONE

- `/root` + `/api/root` → `/os` + `/api/os` (Next build lists `/os/*` routes)
- `lib/root-*` → `lib/os-*`; shells renamed Os*
- `/admin` seed CRM → `redirect("/os")`
- next.config: admin host `/`→`/os`; `/root`→`/os` permanent
- `ops:forbid-root` green; home `tsc` green
- Production build succeeded (`next build` standalone with `/os` tree)
- Co-VideoPro host-surface: `admin.contentco-op.com` is CCO OS (null); proxy 308 → `/os`
- host-surface + admin-client-front-door tests green
- Fossils purged from `archive/repo-preservation`
- kimi `cco-os` marked `NON_CANONICAL.md`
- Canon: `contentco-op/CCO_PRODUCT_CANON.md`

## Deploy

- `publish:m4 --allow-dirty` built successfully then **rsync failed**: `ssh: connect to host blaze.local port 22` (M4 unreachable from this seat)
- Re-run when Blaze/M4 SSH is up: `cd publish-live/apps/home && node scripts/publish-m4-runtime.mjs --allow-dirty`

## Backlog

`docs/operations/RECURSIVE_IMPROVEMENT_BACKLOG.md`
`docs/operations/HOST_CUTOVER_CCO_OS.md`
