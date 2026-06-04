---
title: Rollout Plan
created: 2026-04-30
updated: 2026-05-01
tags: [rollout, plan, phases, cco, site]
---

## Summary

The 5-phase rollout plan for the Content Co-op public site. Plan file: `~/.kimi/plans/sunspot-wolverine-nova.md`.

## Phase 1: Hero Truth Restoration ✅

**Status**: Complete (commit `3ef91b0`)

- Restored dark navy `AmbientVideo` hero
- Re-added `HeroCopyRotator` with flash pulse
- Deleted `hero-section.tsx` (light beige era)
- Fixed title to `"Content Co-op — Minimal stage, maximum signal."`
- Restored client logo ticker (15 logos, infinite scroll)

## Phase 2: Public Page Shell Normalization ✅

**Status**: Complete

- Created `PublicPageLayout` wrapper component
- Adopted across all 8 public pages (`/`, `/portfolio`, `/suite`, `/book`, `/brief`, `/login`, `/terms`, `/privacy`)
- Added dark nav variants for all surfaces
- Wrapped `/brief` in minimal nav + footer
- Fixed `NavSurface` type to include `"terms"` / `"privacy"`
- Unblocked build by fixing `packages/types/src/index.ts`

## Phase 3: Brief Enhancement 🔄

**Status**: Partially complete

**Completed**:
- Shared pricing engine created
- `brief-client.tsx` rewritten with card-select UI concept
- Gradient progress bar CSS added
- Status rail CSS added

**Remaining**:
- Card UI CSS wiring to React components
- Inline validation
- Auto-save draft to Firestore
- Success state redesign
- **AI Proposal Flow**:
  - "Get Your Estimate" button
  - Gemini API enrichment
  - Chicago/NY agency-level proposal generation
  - Proposal page rendering
  - Admin review gate (accept/modify/reject)
  - Stripe deposit (50%)
  - User notification on decision
  - Calendar reservation on deposit

## Phase 4: Cross-Page Visual Polish ⏳

**Status**: Not started

- Portfolio footer replacement
- Suite surface fix
- Book page font typo fix
- Terms/privacy nav addition
- Login nav styling
- Inline style audit across all pages
- Background consistency check

## Phase 5: Build, Deploy, M4 Cleanup ⏳

**Status**: Not started

- Full production build
- Kill stale M4 build on port `4100`
- Update M4 working tree or permanently decommission
- Verify Cloudflare DNS
- Confirm cache invalidation
- Run smoke tests on all public routes

## Inspiration Repo

`~/Desktop/content-coop-brief/` contains:
- `creative-brief.html` — Minimal 3-step glass card prototype
- `index.html` — Full React prototype with card-select UI, live pricing engine, print styles
- `style-a.html` through `style-d.html` — Style exploration variants

## Handoff Document

`~/Desktop/CCO_AGENT_HANDOFF.md` coordinates with other Kimi instance working on overlapping content.

## Related

- [homepage](homepage.md) — Phase 1 work
- [creative-brief](creative-brief.md) — Phase 3 work
- [current-issues](current-issues.md) — Blockers and problems
- [deployment-infrastructure](deployment-infrastructure.md) — Phase 5 work


## Backlinks

- [[creative-brief]]
- [[current-issues]]
- [[index]]
