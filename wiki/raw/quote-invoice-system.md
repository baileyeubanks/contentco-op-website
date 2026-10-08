---
title: Quote & Invoice System
created: 2026-04-30
updated: 2026-10-08
tags: [root, finance, quotes, invoices, stripe, payments]
---

## Summary

The commercial pipeline manages quotes, invoices, and payments. Quotes are generated from creative briefs or manually in CCO OS. Invoices are generated from accepted quotes. Payments flow through Stripe.

## Data Model

### Quotes

| Table | Purpose |
|-------|---------|
| `quotes` | Quote headers (client, status, total, expiry) |
| `quote_items` | Line items (description, quantity, rate, amount) |

### Invoices

| Table | Purpose |
|-------|---------|
| `invoices` | Invoice headers (client, status, total, due_date) |
| `invoice_payments` | Payment records (amount, method, stripe_id) |

### Catalog

| Table | Purpose |
|-------|---------|
| `catalog_items` | Product/service catalog with pricing |

## Quote Flow

1. **Generation**: From brief (`lib/creative-brief-quote-draft.ts`) or manual (`/os/quotes/new`)
2. **Review**: Admin reviews in CCO OS (`/os/quotes/[id]`)
3. **Send**: Client receives shared link (`/share/quote/[id]`)
4. **Accept**: Client accepts via `POST /api/share/quote/[id]/accept` (verified quote capability)
5. **Convert**: System converts to invoice (`POST /api/quotes/[id]/convert`)

## Invoice Flow

1. **Generation**: From quote conversion or manual creation
2. **Issue**: `POST /api/os/invoices/[id]/issue`
3. **Send**: Client receives payment link
4. **Pay**: Stripe checkout session
5. **Confirm**: Webhook `POST /api/webhooks/stripe`
6. **Record**: `POST /api/os/invoices/[id]/record-payment`

## Payment Methods

- **Stripe Checkout**: Primary method for card payments
- **Bank Transfer**: Manual recording via CCO OS
- **Payment Plans**: Split invoices via `POST /api/os/invoices/[id]/split`

## Recurring Invoices

Recurring billing is supported via `GET /api/os/invoices/recurring`. Automation rules trigger invoice generation on schedule.

## API Endpoints

| Method | Route | Purpose |
|--------|-------|---------|
| GET/POST | `/api/quotes` | List/create quotes |
| GET | `/api/quotes/[id]` | Quote detail |
| POST | `/api/quotes/[id]/convert` | Convert to invoice |
| GET | `/api/quotes/[id]/pdf` | Quote PDF |
| GET | `/api/quotes/[id]/preview` | Quote preview |
| GET | `/api/os/quotes` | CCO OS quotes list |
| GET | `/api/os/quotes/[id]` | CCO OS quote detail |
| POST | `/api/os/quotes/[id]/agreement` | Quote agreement |
| POST | `/api/os/quotes/[id]/duplicate` | Duplicate quote |
| GET | `/api/os/invoices` | Invoices list |
| GET | `/api/os/invoices/[id]` | Invoice detail |
| POST | `/api/os/invoices/[id]/issue` | Issue invoice |
| POST | `/api/os/invoices/[id]/pay-link` | Generate payment link |
| POST | `/api/os/invoices/[id]/record-payment` | Record payment |
| POST | `/api/os/invoices/[id]/split` | Split invoice |
| POST | `/api/webhooks/stripe` | Stripe webhook handler |

## Related

- [[creative-brief]] — Quote generation from brief
- [[stripe-integration]] — Payment processing details
- [[client-portal]] — Client-facing quote/invoice views
- [[finance-control]] — Broader finance management

## Client links (S2, 2026-10-08)

CCO-DB resources are served only when business_unit is exactly CC; null is not CC. Quote/invoice links use record-typed, signed `cl1` capabilities in `?t=`, capped at 30 days. Bare IDs and invalid, expired or wrong-type links return the same 404 and a static service@contentco-op.com contact link. Tokens are verified before data access. `/client/portal` and `/api/client/portal` remain closed; `/client/[token]` requires at least 32 URL-safe characters and the entropy sanity check.

Operator copy/open/send requests a new link through the permission-gated share-link action; ordinary read endpoints and public pages do not mint it. The operator-triggered invoice reminder issues a signed URL and skips non-CC/null invoices. Portal row links and Stripe cancel links last seven days. Stripe success uses the static, no-data payment acknowledgement. Portal responses use share_url rather than a raw Stripe link. Quote pay and confirmation forward x-client-link.

Deployment is outside this source packet: merge after SF5 and the approved batch publish. Provision the runtime-owned regular key file (0600) at the absolute expansion of `~/.config/blaze-secrets/cco-website/client-link.key`; configure CCO_CLIENT_LINK_KEY_FILE as a path only. See docs/CCO_CLIENT_LINK_DEPLOYMENT.md for the operator handoff. First key signs; all listed keys verify. Rotate yearly or on suspected leak as policy; actual rotation requires Bailey approval. Remove the retired environment signing secret in that approved window and restart. Bailey may re-send open-item links from CCO OS after deployment; no automatic re-send is authorized here. No migration is needed. Hashing portal tokens at rest is a separate packet.
