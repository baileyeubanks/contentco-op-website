---
title: Portfolio System
created: 2026-04-30
updated: 2026-05-01
tags: [product, marketing, portfolio, gallery]
---

## Summary

The portfolio system showcases Content Co-op's work through a main gallery at `/portfolio` and individual case studies at `/portfolio/[id]`. It includes a rotating gallery on the homepage and a dedicated portfolio page with filterable case studies.

## Routes

| Route | File | Purpose |
|-------|------|---------|
| `/portfolio` | `app/portfolio/page.tsx` | Portfolio gallery with filtering |
| `/portfolio/[id]` | `app/portfolio/[id]/page.tsx` | Individual case study page |

## Data Model

Portfolio case studies use the `PortfolioCaseStudy` type from `@contentco-op/types`:

```typescript
interface PortfolioCaseStudy {
  id: string;
  title: string;
  client: string;
  category: string;
  thumbnail: string;
  videoUrl?: string;
  description: string;
  deliverables: string[];
  results?: string;
}
```

## Proof Media Pipeline

1. **Thumbnail extraction**: `POST /api/media/thumbnail/extract`
2. **Approval workflow**: `POST /api/media/thumbnail/approve`
3. **Approved gallery**: `GET /api/media/thumbnail/approved`
4. **Hero video transcode**: `POST /api/media/hero/transcode`

## Homepage Integration

The `RotatingGallery` component on the homepage pulls from the same portfolio dataset and cycles through case study thumbnails with crossfade animation.

## Related

- [homepage](homepage.md) — RotatingGallery integration
- [api-routes](api-routes.md) — Media API endpoints
- [design-system](design-system.md) — Gallery card styling


## Backlinks

- [[design-system]]
- [[homepage]]
- [[index]]
