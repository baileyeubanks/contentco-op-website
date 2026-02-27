# Content Co-op — Monorepo

Marketing flagship site + shared infrastructure for the Content Co-op product suite.

## Architecture

```
contentco-op (this repo)
├── apps/home            → contentco-op.com (marketing + onboarding)
├── packages/ui          → shared React components
├── packages/brand       → design tokens & CSS variables
├── packages/types       → shared TypeScript interfaces
├── packages/api-client  → typed API client wrapper
├── services/orchestrator → job queue orchestration
├── services/media-worker → video transcoding scripts
└── infra/               → Supabase migrations + Netlify configs
```

## Standalone Apps

Each product app lives in its own repo and deploys independently:

| App | Repo | URL | Stack |
|-----|------|-----|-------|
| Co-Edit | [baileyeubanks/coedit](https://github.com/baileyeubanks/coedit) | coedit.contentco-op.com | Vite + React + FFmpeg.wasm |
| Co-Script | [baileyeubanks/coscript](https://github.com/baileyeubanks/coscript) | coscript.contentco-op.com | Next.js + Supabase |
| Co-Deliver | [baileyeubanks/codeliver](https://github.com/baileyeubanks/codeliver) | codeliver.contentco-op.com | Next.js + Supabase |

## Development

```bash
npm install
npm run dev:home    # Start marketing site on :4100
npm run dev         # Start all workspaces
npm run build       # Production build
```

## Supabase

Shared database: `briokwdoonawhxisbydy.supabase.co`

Migrations live in `infra/supabase/migrations/`.

## Hero Media

Source: `CC_PHOTOS/HLSR+bp_30 Sec Spot_FINAL.mp4`

Regenerate:
```bash
npm run hero:transcode -w @contentco-op/media-worker
```
