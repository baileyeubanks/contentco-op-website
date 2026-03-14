# Content Co-op — Homepage Monorepo

This repo is the Content Co-op homepage workspace. It owns the public marketing site, portfolio, creative-brief funnel, and the shared infrastructure still required by those surfaces.

Canonical platform ownership now lives in the sibling ROOT workspace. ROOT owns the shared backend, control plane, and operations model for Content Co-op and ACS.

## Active Topology

```
contentco-op/monorepo
├── apps/home             → contentco-op.com
├── packages/*            → shared code still used by home/services
├── services/*            → orchestrator + media worker
└── infra/                → migrations + deployment/runtime config
```

## Standalone Product Apps

These products are no longer active children of this monorepo:

| App | Local Workspace | URL | Stack |
|-----|-----------------|-----|-------|
| Co-Cut | `../cocut` | cut.contentco-op.com | Vite + React + FFmpeg.wasm |
| Co-Script | `../coscript` | script.contentco-op.com | Next.js + Supabase |
| Co-Deliver | `../codeliver` | deliver.contentco-op.com | Next.js + Supabase |

Archived monorepo copies of the old product app shells live under `_archive/2026-03-08-standalone-apps/`.

## Development

```bash
npm install
npm run dev:home    # Start marketing site on :4100
npm run dev         # Start active monorepo workspaces
npm run build       # Production build
```

Quality baseline:

```bash
npm run lint
npm run typecheck
npm run ops:audit
```

Repo-owned operations docs live in `docs/operations/`.
Repo-local automation artifacts are written to `ops/reports/`.

## Supabase

Shared database: `briokwdoonawhxisbydy.supabase.co`

Migrations live in `infra/supabase/migrations/`.

## Environment Policy

Use `.env.local.example` as the canonical template for local environment configuration.

## Architecture Contract

ROOT is the canonical platform/control-plane workspace for cross-business operations. This monorepo stays focused on the Content Co-op homepage, portfolio, and creative-brief intake surfaces.

The current public-plus-ops direction lives in [docs/architecture/AUTONOMOUS_CONTENT_COOP_OPERATIONS_PLAN.md](/Users/baileyeubanks/Desktop/Projects/contentco-op/monorepo/docs/architecture/AUTONOMOUS_CONTENT_COOP_OPERATIONS_PLAN.md).

## Hero Media

Source: `CC_PHOTOS/HLSR+bp_30 Sec Spot_FINAL.mp4`

Regenerate:
```bash
npm run hero:transcode -w @contentco-op/media-worker
```
