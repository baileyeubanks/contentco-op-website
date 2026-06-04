---
title: Booking System
created: 2026-04-30
updated: 2026-05-01
tags: [product, marketing, booking, scheduling]
---

## Summary

The booking system allows prospective clients to schedule discovery calls and project kickoffs. It lives at `/book` and integrates with the creative brief flow.

## Routes

| Route | File | Purpose |
|-------|------|---------|
| `/book` | `app/book/page.tsx` | Public booking page |
| `/book` (API) | `api/cco/bookings/route.ts` | Booking creation |
| `/book` (availability) | `api/cco/bookings/availability/route.ts` | Availability lookup |

## Flow

1. Client completes creative brief → sees booking CTA in success state
2. Or navigates directly to `/book`
3. Selects date/time from availability API
4. Booking saved to Firestore via `/api/cco/bookings`
5. Confirmation email sent via Blaze handoff

## Integration with Brief

The brief success state includes a booking URL: `"https://contentco-op.com/book?briefId={id}"`. This pre-fills context for the discovery call.

## Related

- [creative-brief](creative-brief.md) — Success state booking CTA
- [firebase-integration](firebase-integration.md) — Firestore booking storage
- [client-portal](client-portal.md) — Post-booking project tracking


## Backlinks

- [[creative-brief]]
- [[index]]
