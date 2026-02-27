# Content Co-op UI Reference Audit

Last updated: 2026-02-24

## Purpose

Set hard visual and interaction benchmarks for:

1. `Content Co-op` landing (Rivian-grade polish).
2. `Co-Edit` app (Wipster workflow DNA).
3. `Co-Script` app (Sandcastles workflow DNA).

This document is a design control surface so implementation does not drift into generic dashboard styling.

## Sources Reviewed

1. Rivian: [rivian.com](https://rivian.com)
2. Wipster: [wipster.io](https://www.wipster.io), [pricing](https://www.wipster.io/pricing), [integrations](https://www.wipster.io/integrations), [security](https://www.wipster.io/security)
3. Sandcastles: [sandcastles.ai](https://www.sandcastles.ai), [help index](https://help.sandcastles.ai/en)

Note:
Sandcastles help article routes currently resolve to Notion shell output without article body in raw HTML fetch mode; homepage still provides substantial IA/feature signals.

## Benchmark Extraction

## A) Rivian (Landing quality target)

What matters for us:

1. Strict typography system with large display scale and disciplined rhythm.
2. High visual contrast with restrained color count.
3. Hero-first information hierarchy.
4. Controlled motion and transitions (fade/slide/hover), no noisy micro-animations.
5. Navigation clarity with large hit targets and clean grouping.

Technical signal:

1. Next.js app shell.
2. Strong global CSS tokenization.
3. Font strategy with self-hosted brand faces and fallback stack.

Adopt for Content Co-op:

1. Strong display typography hierarchy and spacing cadence.
2. Media-led hero and section sequencing.
3. Reduced decorative noise; use depth, light, and motion intentionally.

Avoid:

1. Automotive-specific mega-nav complexity.
2. Heavy content density on first scroll.

## B) Wipster (Co-Edit capability target)

What matters for us:

1. Review workflow clarity is central, not secondary.
2. Core value: faster review cycles and fewer edit rounds.
3. Collaboration primitives: comments, version comparison, approval flow.
4. Integrations and security are product trust pillars.
5. Pricing and feature framing are workflow-centric, not abstract AI language.

Product cues to replicate in Co-Edit:

1. Review queue and status visibility.
2. Version timeline and compare mode.
3. Comment/task handoff model.
4. Clear transition from draft -> review -> approval.
5. Enterprise readiness cues (roles, security controls, audit posture).

Avoid:

1. Marketing-only storytelling without operational workflow depth.
2. Hiding review controls behind secondary UI.

## C) Sandcastles (Co-Script capability target)

What matters for us:

1. Sharp value narrative: watchlists -> outliers -> vault -> scripts.
2. Section architecture is explicit and conversion-oriented.
3. Feature walkthrough progression is step-based and visual.
4. Pricing/usage is tied to concrete action units (credits).
5. Script generation is framed as workflow acceleration, not novelty.

Product cues to replicate in Co-Script:

1. Structured script input and output workflow.
2. Multi-step analysis-to-generation path.
3. Variant generation and refinement loop.
4. Usage accounting tied to operations.
5. Fast path from selected source material to generated scripts.

Avoid:

1. Generic chat UI that hides structured inputs.
2. Unclear output provenance (must show source context and generation state).

## Design Quality Gaps in Current Build

Current score: 3/10 (agreed baseline).

Gaps:

1. Typography is acceptable but not premium.
2. Information density lacks hierarchy.
3. Components feel placeholder and repetitive.
4. Motion is minimal and not purposeful.
5. No strong visual signature per surface.
6. Co-Edit and Co-Script pages are not yet workflow-native.

## Design Direction v2 (Locked)

## Surface split

1. `Content Co-op`: cinematic, brand-forward, conversion narrative.
2. `Co-Edit`: operational, review-centric, team workflow UI.
3. `Co-Script`: structured generation studio with strong input/output scaffolding.

## Visual system

1. Typography:
   1. Display family for hero statements.
   2. Neutral sans for UI and long-form readability.
2. Color:
   1. Deep ink base.
   2. Controlled electric-blue accent range.
   3. Neutral text tiers for hierarchy.
3. Spacing:
   1. 8px base scale.
   2. Distinct section cadence for marketing vs app surfaces.
4. Motion:
   1. Entrance choreography for landing sections.
   2. Subtle state transitions in app views.
   3. Reduced-motion support by default.

## Component inventory for immediate implementation

1. Top navigation with active surface indicator.
2. Hero composition with primary/secondary CTA.
3. Feature rail cards (marketing).
4. Trust + metrics strip.
5. Workspace shell (sidebar + content + action rail).
6. Watchlist control panel.
7. Outlier table/card switch.
8. Vault cards with quick-save state.
9. Script brief form sections.
10. Script output pane with variants/tabs.
11. Compare modal.
12. Usage meter and limits card.

## Acceptance bar for next pass

The next implementation pass is accepted only if:

1. Visual quality reaches 8/10 against this reference.
2. Each surface has distinct visual purpose.
3. Co-Edit and Co-Script workflows are understandable in first 15 seconds.
4. No placeholder copy or generic dashboard scaffolding remains.
5. Typography and spacing system are tokenized and reusable.

