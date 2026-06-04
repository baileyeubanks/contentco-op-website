---
title: Design System
created: 2026-04-30
updated: 2026-05-01
tags: [design, brand, css, tokens, components]
---

## Summary

The Content Co-op design system consists of brand tokens, CSS primitives, shared UI components, and a dark navy visual identity. Brand assets live in `contentco-op/brand/` and are consumed via `@contentco-op/brand` package.

## Brand Tokens

`contentco-op/brand/data/tokens/`:
- `primitives.json` — Raw color, spacing, typography values
- `semantic.json` — Theme-mapped tokens
- `themes.json` — Dark/light theme definitions

## CSS Adapters

`contentco-op/brand/adapters/css/`:
- `tokens.css` — CSS custom properties
- `components.css` — Component-level styles
- `document.css` — Document-level typography

## Visual Identity

### Colors
- **Hero background**: `#111b30` (dark navy)
- **Accent**: `#4c8ef5` (periwinkle)
- **Nav background**: `rgba(17,27,48,0.85)` (dark translucent)
- **Footer**: `#081324` (darker navy)
- **Text**: White on dark, `#1a1a1a` on light

### Typography
- Headlines: Large, bold, with periwinkle italic emphasis
- Body: Clean sans-serif
- Nav links: White on dark surfaces

### Surfaces

| Surface | Background | Text | Usage |
|---------|-----------|------|-------|
| `home` | Dark navy | White | Homepage hero |
| `portfolio` | Dark navy | White | Portfolio page |
| `suite` | Dark navy | White | Product suite |
| `brief` | Dark navy | White | Creative brief |
| `booking` | Dark navy | White | Booking page |
| `login` | Dark navy | White | Auth pages |
| `terms` | Light | Dark | Legal pages |
| `privacy` | Light | Dark | Legal pages |

## Shared Components

### `PublicPageLayout`
Wrapper for all public pages. Props:
- `surface: CcoNavSurface` — nav styling context
- `theme: 'dark' | 'light' | 'cream'` — page theme
- `navVariant: 'full' | 'minimal'` — nav complexity
- `showNav: boolean`
- `showFooter: boolean`

### `CcoNav`
Navigation component with surface-aware styling.

### `PublicFooter`
Dark footer with social links, content grid, copyright.

## Client Logo Ticker

15-logo infinite scroll ticker between hero and content sections:
- CSS class: `.client-logos` with `.client-logos-ticker` track
- Gradient masks on edges for fade effect
- Infinite CSS animation

## Assets

Logo assets:
- `Desktop/SECRETS/LOGOS FINAL/` — EPS, PDF, PNG, SVG exports
- `Desktop/Projects/media/cco_logo/` — CCO logo files
- `contentco-op/brand/assets/cco/` — Brand exports, photography, motion

## Related

- [[homepage]] — Design in practice
- [[monorepo-structure]] — Package architecture
- [[portfolio-system]] — Gallery styling
