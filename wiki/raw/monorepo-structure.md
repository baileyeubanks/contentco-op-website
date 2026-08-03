---
title: Monorepo Structure
created: 2026-04-30
updated: 2026-05-01
tags: [monorepo, architecture, nextjs, turbo]
---

## Summary

The Content Co-op monorepo is a Next.js 16 + Turbo + pnpm workspaces setup. It serves the public marketing site, CCO OS admin surface, and shared packages.

## Directory Structure

```
contentco-op-monorepo/
├── apps/
│   ├── home/              # Canonical Next.js app (marketing + CCO OS)
│   ├── cocut/             # Mirror: Co-Cut (Vite + React)
│   ├── coscript/          # Mirror: Co-Script (Next.js)
│   └── codeliver/         # Mirror: Co-Deliver (Next.js)
├── packages/
│   ├── api-client/        # Typed API client utilities
│   ├── brand/             # Brand tokens (CSS + TS)
│   ├── identity-access/   # Auth, permissions, session
│   ├── pricing/           # Pricing calculation logic
│   ├── types/             # Shared TypeScript definitions
│   └── ui/                # Shared React UI components
├── services/
│   ├── documents/         # Python document renderer
│   ├── media-worker/      # Thumbnail extraction, transcoding
│   └── orchestrator/      # Workflow orchestrator (Node.js)
├── infra/
│   └── supabase/migrations/  # SQL schema migrations
├── docs/
│   ├── architecture/      # API contracts, domain policy
│   ├── brand/             # Design systems, logos
│   ├── operations/        # Runbooks, runtime contracts
│   └── ui/                # Flow maps, reference audits
├── scripts/               # Monorepo automation
├── wiki/                  # Project wiki (this)
└── design-options/        # UI render options
```

## Workspace Config

`package.json` workspaces:
```json
{ "workspaces": ["apps/*", "packages/*", "services/*"] }
```

Turbo pipeline in `turbo.json`:
```json
{ "pipeline": { "build": { "dependsOn": ["^build"] }, "dev": {}, "lint": {}, "typecheck": {} } }
```

## Apps

### `apps/home`
- **Framework**: Next.js 16.1.6, App Router
- **React**: 19
- **Styling**: CSS Modules + global CSS
- **Key deps**: Supabase, Stripe, Firebase, Tailwind 4, Leaflet
- **Output**: Next.js standalone

### `apps/cocut`, `apps/coscript`, `apps/codeliver`
- Archived mirrors of standalone product apps
- Live versions run on M4 via Cloudflare tunnels

## Packages

### `@contentco-op/types`
Shared TypeScript definitions. See [[types-system]].

### `@contentco-op/ui`
Shared React components:
- `CcoNav` — Navigation component
- `PublicFooter` — Footer component
- Surface and theme configuration

### `@contentco-op/brand`
Design tokens and CSS primitives. See [[design-system]].

### `@contentco-op/pricing`
Pricing calculation engine for quotes and estimates.

### `@contentco-op/identity-access`
Authentication, session management, permissions, audit.

### `@contentco-op/api-client`
Typed API client utilities for internal and external APIs.

## Transpiled Packages

In `apps/home/next.config.ts`:
```typescript
transpilePackages: [
  '@contentco-op/ui',
  '@contentco-op/brand',
  '@contentco-op/types',
  '@contentco-op/identity-access',
  '@contentco-op/pricing'
]
```

## Related

- [[types-system]] — Package type definitions
- [[design-system]] — Brand tokens
- [[build-deploy-pipeline]] — How we build
