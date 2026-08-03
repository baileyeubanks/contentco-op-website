---
title: Quote & Invoice System
created: 2026-04-30
updated: 2026-05-01
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
4. **Accept**: Client accepts via `POST /api/client/quote/[id]/accept`
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

- [creative-brief](creative-brief.md) — Quote generation from brief
- [stripe-integration](stripe-integration.md) — Payment processing details
- [client-portal](client-portal.md) — Client-facing quote/invoice views
- [finance-control](finance-control.md) — Broader finance management


## Backlinks

- [[client-portal]]
- [[contact-intelligence]]
- [[creative-brief]]
- [[dispatch-operations]]
- [[finance-control]]
- [[index]]
- [[root-overview]]
- [[stripe-integration]]
