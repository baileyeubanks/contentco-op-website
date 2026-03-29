# Content Co-op — Homepage Monorepo

This repo is the live Content Co-op homepage workspace. It owns the public
marketing site, portfolio, creative-brief funnel, and the mounted ROOT runtime
currently served under `/root`.

Canonical ROOT contracts, domain rules, and tests still live in the sibling
`root/` workspace, but the live `/root` web runtime ships from this repo's
`apps/home` artifact today.

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

Non-canonical mirror copies still exist under `apps/cocut`, `apps/coscript`,
and `apps/codeliver` for migration/reference only. Do not edit those paths
expecting a public deploy.

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
npm run ops:publish
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

ROOT is the canonical platform/control-plane contract workspace for
cross-business operations. This monorepo is also the current live runtime host
for mounted ROOT routes, in addition to the Content Co-op homepage, portfolio,
and creative-brief intake surfaces.

The current public-plus-ops direction lives in [docs/architecture/AUTONOMOUS_CONTENT_COOP_OPERATIONS_PLAN.md](/Users/baileyeubanks/Desktop/Projects/contentco-op/monorepo/docs/architecture/AUTONOMOUS_CONTENT_COOP_OPERATIONS_PLAN.md).

## Hero Media

Source: `CC_PHOTOS/HLSR+bp_30 Sec Spot_FINAL.mp4`

Regenerate:
```bash
npm run hero:transcode -w @contentco-op/media-worker
```
