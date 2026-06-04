---
title: Product Suite
created: 2026-04-30
updated: 2026-05-01
tags: [product, marketing, co-cut, co-script, co-deliver]
---

## Summary

Content Co-op offers three productized services: Co-Cut (video editing), Co-Script (scriptwriting), and Co-Deliver (delivery/publishing). Each has a dedicated landing page and standalone application.

## Products

### Co-Cut
- **Landing**: `/co-cut` (`app/co-cut/page.tsx`)
- **Standalone app**: `contentco-op/cocut/` (Vite + React + FFmpeg.wasm)
- **Subdomain**: `cut.contentco-op.com`
- **Purpose**: Browser-based video editing with FFmpeg.wasm

### Co-Script
- **Landing**: `/co-script` (`app/co-script/page.tsx`)
- **Standalone app**: `contentco-op/coscript/` (Next.js + Supabase)
- **Subdomain**: `script.contentco-op.com`
- **Purpose**: AI-assisted scriptwriting and screenplay formatting

### Co-Deliver
- **Landing**: `/co-deliver` (`app/co-deliver/page.tsx`)
- **Standalone app**: `contentco-op/codeliver/` (Next.js + Supabase)
- **Subdomain**: `deliver.contentco-op.com`
- **Purpose**: Content delivery and publishing workflow

## Product Suite Page

`/suite` (`app/suite/page.tsx`) and `/product-suite` provide an overview of all three products with comparison cards and pricing signals.

## Pricing

Pricing calculations live in `@contentco-op/pricing`. The `calculate.ts` module provides per-product estimation logic based on scope, runtime, and complexity.

## Monorepo Integration

The standalone product apps (cocut, coscript, codeliver) are archived/mirrored in `apps/cocut`, `apps/coscript`, `apps/codeliver` but the live versions run on M4 (Blaze host) via Cloudflare tunnels on ports 4102-4104.

## Related

- [[homepage]] — Products grid section
- [[monorepo-structure]] — App architecture
- [[deployment-infrastructure]] — M4 tunneling
