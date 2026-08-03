# CCO OS migration publish — 2026-08-03

**Shipped:** `9c61f4470fee202af4d41c9b4cf9f1c59fc37c7b` (branch
`claude/brief-unreachable-error-20260803`, pushed to origin `main` by
`publish:live`). **Previous live:** `27f04b2d6267…` (2026-07-31).

## What shipped

1. **ROOT→OS retirement migration** (Codex's staged workstream, reconciled and
   committed by Kimi/Cursor):
   - `88688f0` — 205 renames: `app/api/root→app/api/os` (92),
     `app/root→app/os` (76), `lib/root-*→lib/os-*`, identity-access
     `root-adapter→os-adapter`, tests.
   - `14d2bd5` — reference retarget (app/lib/packages/scripts/wiki), `/admin`
     replaced with noindex redirect → `/os`, nav rail rework (Book a Call,
     admin-host detection), `next.config` redirect map now sourced from
     `lib/legacy-root-redirects.ts`.
   - `a7e91b6` — `/os/co-cut`, `lib/request-origin.ts` (auth-origin fix),
     redirect map, `ops:forbid-root` gate, handoff/cutover/backlog docs.
   - `6873f92` — deletions: brandcentral ROOT static pages, wiki ROOT docs,
     public `app/scenario-lab/page.tsx`.
2. **FIX-5** — merge `5ea2f68` of `cursor/fix5-scenario-lab` (`332a6e2`):
   500ing public `/scenario-lab` removed (route, PWA shortcut/screenshot,
   robots disallow, validator refs). Conflicts in `app/manifest.ts` and
   `scripts/validate-pwa-assets.mjs` resolved as union: keep Book a Call,
   drop scenario-lab.
3. **FIX-4 completion** — `9c61f44`: steps 2 and 3 of `/brief` had step 1's
   dead-button defect (`disabled={!projectReady}` / `!scopeReady}` made
   moveTo's specific guards unreachable and dropped the primaries from tab
   order). Both now gate on `isBusy` only; guards speak.

## Live evidence (post-publish)

- `GET /api/runtime-proof` → `build_id=9c61f4470fee202af4d41c9b4cf9f1c59fc37c7b`
- `/`, `/brief`, `/suite`, `/portfolio`, `/book`, `/privacy`, `/terms`,
  `/login` → 200; `/scenario-lab` → 404
- `/root` → **308 → /os**; `/root/quotes` → 308 → `/os/quotes`;
  `/api/root/:path*` → 308 → `/api/os/:path*` (graceful retire, per
  HOST_CUTOVER_CCO_OS.md)
- `admin.contentco-op.com` is served by this same home runtime:
  `/` → 307 → `/os` (200, operator sign-in gate), `/root` → 308 → `/os`,
  `/login` → 307 → `/os/login`
- `/brief` (Playwright, intake APIs route-mocked — nothing written to CRM):
  all three step primaries `disabled=false tabIndex=0` on empty steps; empty
  clicks render role=alert "Add name, email, phone, company, and location." /
  "Choose a project type and add a short summary." /
  "Choose a placement, deliverable, and timeline." Step 3 ships with defaults
  selected, so the untouched click legitimately advances (nothing missing).

## Gates at ship time

build 9/9 · typecheck 8/8 · vitest 19/19 · ops:pwa (7 images) · ops:portfolio ·
verify:cco-nav · verify:platform · ops:forbid-root · tree == HEAD, zero dirty.

## Rollback

Script auto-rollbacks on preflight/health failure (previous release symlink
restored + kickstart). Manual: repoint
`~/.contentco-op/home-runtime/current` → `releases/27f04b2d6267` on Blaze,
`launchctl kickstart -k gui/$(id -u)/ai.contentcoop.home-runtime`. Not triggered.

## Known / parked

- `ops:routes` flags live `/book`: manifest smoke expects a 3xx to
  calendar.google.com but `/book` is a deliberate booking page (200).
  Pre-existing contract drift, unrelated to this publish; reconcile the
  manifest expectation or the page in a future cycle.
- `apps/home/pwa/` is a tracked stale duplicate of `public/pwa` (incl. an
  unreferenced `screenshot-scenario-lab.png`); not served. Candidate for
  deletion in a hygiene pass.
- `capture:root-ui` script in apps/home/package.json points at a missing
  file (pre-existing).
