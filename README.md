# Content Co-op — Homepage + CCO OS runtime

Canonical product law: `/Users/baileyeubanks/Desktop/Projects/contentco-op/CCO_PRODUCT_CANON.md`

This repo owns:

- **Public** Content Co-op marketing (`contentco-op.com`) — Cream Editorial
- **CCO OS** commercial operator surface under `/os/*` and `/api/os/*` (`admin.contentco-op.com`)

**ROOT** and **Mission Control** are dead. Do not resurrect `/root` routes or those names.
Legacy `/root` URLs permanently redirect to `/os`.

**Co-VideoPro** is a separate product (`co-videopro.com`). It receives accepted commercial
packages and must not alter quote totals.

## Development

```bash
npm install
npm run dev:home
npm run ops:forbid-root
npm run publish:live
```

## Supabase

CCO-DB: `briokwdoonawhxisbydy.supabase.co` (registry name **CCO OS**).
