# Content Co-op — Monorepo/Standalone Reconciliation

## Context

I have a monorepo at `~/Desktop/contentco-op` and three standalone repos extracted from it:
- `~/Desktop/coedit` (standalone, Vite + React, REWRITTEN — this is the good one)
- `~/Desktop/coscript` (standalone, Next.js, extracted from monorepo)
- `~/Desktop/codeliver` (standalone, Next.js, extracted from monorepo)

The monorepo (`contentco-op`) contains:
- `apps/home` — Next.js marketing flagship (contentco-op.com, port 4100). KEEP.
- `apps/coedit` — OLD Next.js shell. STALE. The standalone replaced this entirely.
- `apps/coscript` — Next.js script generator. STALE. Standalone is source of truth.
- `apps/coproof` — Next.js delivery/approvals. NEVER EXTRACTED. May overlap with codeliver.
- `packages/ui` — shared UI components (@contentco-op/ui)
- `packages/brand` — brand tokens (@contentco-op/brand)
- `packages/types` — shared TypeScript types (@contentco-op/types)
- `packages/api-client` — API client utilities (@contentco-op/api-client)
- `services/orchestrator` — job queue service (port 4300)
- `services/media-worker` — video transcoding
- `infra/supabase/migrations` — DB schema
- `infra/netlify` — deploy configs

## Problems

1. **Co-Script and Co-Deliver standalone repos still import `@contentco-op/ui`, `@contentco-op/brand`, `@contentco-op/types`** — these packages only exist in the monorepo's `packages/` dir. The standalones CAN'T BUILD independently.

2. **Co-Proof (monorepo only) and Co-Deliver (standalone only) appear to be the same concept** — both handle asset delivery, approvals, and stakeholder sign-off. Need to reconcile.

3. **Stale code in monorepo** — `apps/coedit` and `apps/coscript` are superseded by standalones but still sitting in the monorepo, causing confusion.

## Task — Execute in this exact order:

### Phase 1: Assess Overlap (read-only, no changes)

1. Diff the API routes between `apps/coproof/` (monorepo) and `~/Desktop/codeliver/` — list every route in both, identify which is more complete. Show me the comparison.
2. Diff the shared packages — for each of `packages/ui`, `packages/brand`, `packages/types`, `packages/api-client`: list every export and show which standalones actually use which exports.
3. Tell me: can coproof and codeliver be merged into ONE app? If so, which has the better foundation?

### Phase 2: Decouple Standalones (after I approve Phase 1)

For `~/Desktop/coscript` and `~/Desktop/codeliver` (or the merged version):

4. **Inline the shared packages.** Copy the actual source code from `packages/ui`, `packages/brand`, `packages/types` into each standalone repo under a local `packages/` or `lib/` directory. Update all imports. Remove the workspace reference. Each standalone must `npm install && npm run build` successfully on its own with ZERO references to the monorepo.

5. **Verify builds.** Run `npm install && npm run build` in each standalone. Fix any errors. Every standalone must build clean.

### Phase 3: Clean the Monorepo

6. **Remove stale apps.** Delete `apps/coedit` and `apps/coscript` from the monorepo (they're superseded). If we merged coproof into codeliver, delete `apps/coproof` too.

7. **Update the monorepo README.** Reflect that the monorepo now only contains `apps/home` + shared infrastructure. List the standalone repos and their GitHub URLs:
   - coedit → github.com/baileyeubanks/coedit
   - coscript → github.com/baileyeubanks/coscript
   - codeliver → github.com/baileyeubanks/codeliver

8. **Update `apps/home`** nav and routing to link OUT to the standalone subdomains:
   - coedit.contentco-op.com
   - coscript.contentco-op.com
   - codeliver.contentco-op.com (or coproof.contentco-op.com — whichever name we keep)

### Phase 4: Git Hygiene

9. **Commit each standalone** with a clean message like: `chore: decouple from monorepo, inline shared packages`
10. **Commit the monorepo cleanup** with: `chore: remove stale apps, update architecture to standalone model`
11. **Do NOT push yet** — just commit locally. I'll review and push manually.

## Architecture After Reconciliation

```
contentco-op (monorepo) — github.com/baileyeubanks/contentco-op-website
├── apps/home            → contentco-op.com (marketing flagship)
├── packages/ui          → shared components (consumed by home only now)
├── packages/brand       → brand tokens
├── packages/types       → shared types
├── packages/api-client  → API client
├── services/orchestrator
├── services/media-worker
└── infra/

coedit (standalone) — github.com/baileyeubanks/coedit
└── Vite + React SPA    → coedit.contentco-op.com

coscript (standalone) — github.com/baileyeubanks/coscript
└── Next.js app          → coscript.contentco-op.com

codeliver (standalone) — github.com/baileyeubanks/codeliver
└── Next.js app          → codeliver.contentco-op.com
```

Each standalone is fully independent. The monorepo is the marketing site + shared infra. Subdomains link them together for users.

## Constraints
- Do NOT modify `~/Desktop/coedit` beyond what's needed — it's already working well
- Do NOT break the monorepo's `apps/home` — that's the live marketing site
- Supabase URL: `https://briokwdoonawhxisbydy.supabase.co` (shared across all apps)
- All apps use Netlify for deployment
- Show me Phase 1 results before executing Phase 2+
