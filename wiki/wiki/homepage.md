---
title: Homepage
created: 2026-04-30
updated: 2026-05-01
tags: [product, marketing, homepage, nextjs]
---

## Summary

The Content Co-op homepage is a Next.js 16 App Router page at `apps/home/app/page.tsx`. It serves as the primary inbound surface with a dark navy hero, client logo ticker, rotating gallery, products grid, and trust section.

## Visual Identity

- **Hero background**: Dark navy `#111b30` with `AmbientVideo` looping background
- **Headline**: "Minimal stage, / maximum signal." in white + periwinkle italic `#4c8ef5`
- **Animation**: Flash pulse on `HeroCopyRotator`
- **Nav**: Dark translucent `rgba(17,27,48,0.85)` with white links
- **Full-bleed positioning image** below hero
- **Client logos**: 15-logo infinite scroll ticker between S1 (Hero) and S2 (Full-Bleed)

## Page Structure

```
PublicPageLayout (surface="home", theme="dark")
├── SeoJsonLd (organization + website + service structured data)
├── S1: Hero (AmbientVideo + HeroCopyRotator)
├── Logo Ticker (client-logos infinite scroll)
├── S2: Full-Bleed Positioning Image
├── S3: Rotating Gallery
├── S4: Products Grid
├── S5: Trust Section (Bailey headshot + signature)
└── PublicFooter
```

## Key Components

| Component | File | Purpose |
|-----------|------|---------|
| `AmbientVideo` | `app/components/ambient-video.tsx` | Full-bleed looping video background |
| `HeroCopyRotator` | `app/components/hero-copy-rotator.tsx` | Rotating headline with flash pulse |
| `PublicPageLayout` | `app/components/public-page-layout.tsx` | Shared nav/footer wrapper |
| `PublicFooter` | `app/components/public-footer.tsx` | Dark footer with social links |
| `RotatingGallery` | `app/components/rotating-gallery.tsx` | Portfolio image carousel |

## SEO

- Title: `"Content Co-op — Minimal stage, maximum signal."` (from `lib/seo.ts`)
- Meta: OpenGraph image generated via `opengraph-image.tsx`
- Structured data: Organization, WebSite, Service JSON-LD

## Bad Build Identifier

Any build containing `hero-shell` + `Industrial Storytelling` or title `"Industrial Video Production..."` is the wrong era and must be rejected.

## Cache Invalidation

Next.js standalone emits `Cache-Control: s-maxage=31536000`. Must fully kill (`kill -9` if needed) and restart standalone server to load new build. Cloudflare edge is `DYNAMIC` (doesn't cache HTML by default).

## Related

- [portfolio-system](portfolio-system.md) — Case study gallery
- [product-suite](product-suite.md) — Product grid links here
- [design-system](design-system.md) — Brand tokens and CSS


## Backlinks

- [[design-system]]
- [[index]]
- [[portfolio-system]]
- [[product-suite]]
- [[rollout-plan]]
