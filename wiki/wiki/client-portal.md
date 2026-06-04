---
title: Client Portal
created: 2026-04-30
updated: 2026-05-01
tags: [product, client-portal, quotes, invoices]
---

## Summary

Tokenized client portals allow clients to view quotes, approve estimates, pay invoices, and track project progress without logging in. Each portal is accessed via a unique token URL.

## Routes

| Route | File | Purpose |
|-------|------|---------|
| `/client/portal` | `app/client/portal/page.tsx` | Portal lookup by email/token |
| `/client/[token]` | `app/client/[token]/page.tsx` | Tokenized client dashboard |
| `/client/quote/[id]` | `app/client/quote/[id]/page.tsx` | Client quote view |
| `/share/quote/[id]` | `app/share/quote/[id]/page.tsx` | Shared quote view (no auth) |
| `/share/invoice/[id]` | `app/share/invoice/[id]/page.tsx` | Shared invoice view |

## API Endpoints

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/client/[token]` | Portal data |
| POST | `/api/client/[token]/messages` | Client messages |
| GET | `/api/client/portal` | Portal lookup |
| GET | `/api/client/quote/[id]` | Quote data |
| POST | `/api/client/quote/[id]/accept` | Accept quote |
| POST | `/api/client/quote/[id]/pay` | Initiate payment |
| POST | `/api/client/quote/[id]/pay/confirm` | Confirm payment |
| GET | `/api/client/estimate/[id]` | Estimate data |
| POST | `/api/client/estimate/[id]/decision` | Approve/reject estimate |
| GET | `/api/client/invoice/[id]` | Invoice data |
| POST | `/api/client/invoice/[id]/pay` | Pay invoice |
| POST | `/api/client/invoice/[id]/pay/confirm` | Confirm invoice payment |

## Token Security

Tokens are cryptographically random strings stored in Firestore. Each token maps to a `person` record and grants read access to associated quotes, invoices, and projects.

## Quote Acceptance Flow

1. Client views shared quote at `/share/quote/{id}`
2. Clicks "Accept" → POST `/api/client/quote/{id}/accept`
3. System generates invoice draft
4. Client receives payment link
5. Payment processed via Stripe
6. Project status updated to "active"

## Related

- [quote-invoice-system](quote-invoice-system.md) — Backend quote/invoice logic
- [stripe-integration](stripe-integration.md) — Payment processing
- [contact-intelligence](contact-intelligence.md) — Client CRM data


## Backlinks

- [[booking-system]]
- [[creative-brief]]
- [[index]]
- [[quote-invoice-system]]
- [[stripe-integration]]
