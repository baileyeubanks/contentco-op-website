# Content Co-op Monorepo (v2.1 MVP)

Three-surface system with one brand and two standalone products.

## Surfaces

1. `contentco-op.com` (`apps/home`) - bright cinematic flagship and brief entry.
2. `coedit.contentco-op.com` (`apps/coedit`) - dark precision review and approvals.
3. `coscript.contentco-op.com` (`apps/coscript`) - dark signal-first script generation.

## Repository layout

1. `apps/home`, `apps/coedit`, `apps/coscript`
2. `packages/ui`, `packages/brand`, `packages/types`, `packages/api-client`
3. `services/orchestrator` (single orchestrator service)
4. `services/media-worker` (transcode and thumbnail workflow scripts)
5. `infra/supabase/migrations` (schema)
6. `infra/netlify` (site-specific deploy config)

## Run locally

```bash
npm install
npm run dev:home
npm run dev:coedit
npm run dev:coscript
```

Ports:

1. Home: `http://localhost:4100`
2. Co-Edit: `http://localhost:4101`
3. Co-Script: `http://localhost:4102`

## Invite-only access

Set `CCO_INVITE_CODE` in environment before testing auth forms.

## Hero media

Current hero source:

`/Users/baileyeubanks/Desktop/CC_PHOTOS/HLSR+bp_30 Sec Spot_FINAL.mp4`

Generated outputs:

1. `apps/home/public/media/hero-1080.mp4`
2. `apps/home/public/media/hero-1080.webm`
3. `apps/home/public/media/hero-poster.jpg`

Regenerate:

```bash
npm run hero:transcode -w @contentco-op/media-worker
```

## API contract status

MVP route stubs implemented for:

1. Auth (`/api/auth/login`)
2. Co-Edit (`/api/coedit/*`)
3. Co-Script (`/api/coscript/*`)
4. Media workflow (`/api/media/*`)

Wire these handlers to Supabase and queue workers in next implementation pass.

