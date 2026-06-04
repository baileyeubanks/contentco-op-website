---
title: Build & Deploy Pipeline
created: 2026-04-30
updated: 2026-05-01
tags: [build, deploy, ci, nextjs, standalone]
---

## Summary

The Content Co-op build pipeline uses pnpm + Turbo for local builds and Next.js standalone output for production deployment on the M2 MacBook.

## Local Development

```bash
# Install dependencies
pnpm install

# Dev server (with hot reload)
pnpm dev

# Type check
pnpm typecheck

# Lint
pnpm lint

# Build all packages + apps
pnpm build
```

## Production Build

```bash
cd apps/home

# Build with standalone output
pnpm build

# Output directory
.next/standalone/
```

## Deployment Steps

1. **Build**: `pnpm build` in `apps/home`
2. **Verify build**: Check `.next/standalone/server.js` exists
3. **Kill old server**: Find and kill existing Next.js process
   ```bash
   lsof -ti:4100 | xargs kill -9
   ```
4. **Start new server**:
   ```bash
   node .next/standalone/server.js
   ```
5. **Verify**: `curl -H "Host: contentco-op.com" http://localhost:4100`
6. **Check Cloudflare**: Tunnel `cco-mission-control` should route traffic

## Critical: Cache Invalidation

Next.js standalone emits:
```
Cache-Control: s-maxage=31536000
```

Must **fully kill and restart** the server. Overwriting files is not sufficient — the old process keeps the old build in memory.

## Docker

`Dockerfile` in repo root:
- Multi-stage build
- Node 20 base image
- Standalone output
- Used by `publish-home-image.yml` GitHub workflow

## GitHub Workflows

| Workflow | File | Purpose |
|----------|------|---------|
| CI | `.github/workflows/ci.yml` | Lint, typecheck, test |
| Security | `.github/workflows/ci-security.yml` | Security scanning |
| Publish | `.github/workflows/publish-home-image.yml` | Docker image build |

## Environment

- **Node**: v22.22.0 active (package.json expects 20.x)
- **Package manager**: pnpm
- **Build tool**: Turbo

## Current Git State

- `main` at `3ef91b0` (correct dark hero)
- Diverged from `m4tmp/main` (20 ahead, 78 behind)
- `CCO_OS_FREEZE_20260430_151256` contains git snapshot of uncommitted changes

## Recovery

If deployment fails:
1. Check `RUNBOOK_BAD_DEPLOY.md`
2. Check `RUNBOOK_BROKEN_PUBLIC_ROUTE.md`
3. Check `DEPLOY_TRIAGE_SYSTEM.md`
4. Rollback to last known good commit
5. Verify DNS points to correct tunnel

## Related

- [deployment-infrastructure](deployment-infrastructure.md) — Hardware and tunnels
- [monorepo-structure](monorepo-structure.md) — Workspace setup
- [current-issues](current-issues.md) — Active deployment problems


## Backlinks

- [[deployment-infrastructure]]
- [[index]]
- [[monorepo-structure]]
