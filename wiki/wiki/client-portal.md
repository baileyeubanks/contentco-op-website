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
| `/client/portal` | `app/client/portal/page.tsx` | Portal view by opaque `?token=` only (no email lookup; `/api/client/portal` was removed) |
| `/client/[token]` | `app/client/[token]/page.tsx` | Tokenized client dashboard |
| `/client/quote/[id]` | `app/client/quote/[id]/page.tsx` | Client quote view |
| `/share/quote/[id]` | `app/share/quote/[id]/page.tsx` | Shared quote view (no auth) |
| `/share/invoice/[id]` | `app/share/invoice/[id]/page.tsx` | Shared invoice view |

## API Endpoints

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/client/[token]` | Portal data |
| POST | `/api/client/[token]/messages` | Client messages |
| POST | `/api/client/quote/[id]/accept` | Accept quote |
| POST | `/api/client/quote/[id]/pay` | Initiate payment |
| POST | `/api/client/quote/[id]/pay/confirm` | Confirm payment |
| POST | `/api/client/estimate/[id]/decision` | Approve/reject estimate |
| POST | `/api/client/invoice/[id]/pay` | Pay invoice |

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

## Client links (S2, 2026-10-08)

CCO-DB resources are served only when business_unit is exactly CC; null is not CC. Quote/invoice links use record-typed, signed `cl1` capabilities in `?t=`, capped at 30 days. Bare IDs and invalid, expired or wrong-type links return the same 404 and a static service@contentco-op.com contact link. Tokens are verified before data access. `/client/portal` and `/api/client/portal` remain closed; `/client/[token]` requires at least 32 URL-safe characters and the entropy sanity check.

Operator copy/open/send requests a new link through the permission-gated share-link action; ordinary read endpoints and public pages do not mint it. The operator-triggered invoice reminder issues a signed URL and skips non-CC/null invoices. Portal row links and Stripe cancel links last seven days. Stripe success uses the static, no-data payment acknowledgement. Portal responses use share_url rather than a raw Stripe link. Quote pay and confirmation forward x-client-link.

Deployment is outside this source packet: merge after SF5 and the approved batch publish. Provision a runtime-owned regular key file (0600) and configure CCO_CLIENT_LINK_KEY_FILE as a path only. First key signs; all listed keys verify. Rotate yearly or on suspected leak as policy; actual rotation requires Bailey approval. Remove the retired environment signing secret in that approved window and restart. Bailey may re-send open-item links from CCO OS after deployment; no automatic re-send is authorized here. No migration is needed. Hashing portal tokens at rest is a separate packet.
