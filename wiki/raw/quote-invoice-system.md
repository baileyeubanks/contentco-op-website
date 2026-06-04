---
title: Quote & Invoice System
created: 2026-04-30
updated: 2026-05-01
tags: [root, finance, quotes, invoices, stripe, payments]
---

## Summary

The commercial pipeline manages quotes, invoices, and payments. Quotes are generated from creative briefs or manually in ROOT. Invoices are generated from accepted quotes. Payments flow through Stripe.

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

1. **Generation**: From brief (`lib/creative-brief-quote-draft.ts`) or manual (`/root/quotes/new`)
2. **Review**: Admin reviews in ROOT (`/root/quotes/[id]`)
3. **Send**: Client receives shared link (`/share/quote/[id]`)
4. **Accept**: Client accepts via `POST /api/client/quote/[id]/accept`
5. **Convert**: System converts to invoice (`POST /api/quotes/[id]/convert`)

## Invoice Flow

1. **Generation**: From quote conversion or manual creation
2. **Issue**: `POST /api/root/invoices/[id]/issue`
3. **Send**: Client receives payment link
4. **Pay**: Stripe checkout session
5. **Confirm**: Webhook `POST /api/webhooks/stripe`
6. **Record**: `POST /api/root/invoices/[id]/record-payment`

## Payment Methods

- **Stripe Checkout**: Primary method for card payments
- **Bank Transfer**: Manual recording via ROOT
- **Payment Plans**: Split invoices via `POST /api/root/invoices/[id]/split`

## Recurring Invoices

Recurring billing is supported via `GET /api/root/invoices/recurring`. Automation rules trigger invoice generation on schedule.

## API Endpoints

| Method | Route | Purpose |
|--------|-------|---------|
| GET/POST | `/api/quotes` | List/create quotes |
| GET | `/api/quotes/[id]` | Quote detail |
| POST | `/api/quotes/[id]/convert` | Convert to invoice |
| GET | `/api/quotes/[id]/pdf` | Quote PDF |
| GET | `/api/quotes/[id]/preview` | Quote preview |
| GET | `/api/root/quotes` | ROOT quotes list |
| GET | `/api/root/quotes/[id]` | ROOT quote detail |
| POST | `/api/root/quotes/[id]/agreement` | Quote agreement |
| POST | `/api/root/quotes/[id]/duplicate` | Duplicate quote |
| GET | `/api/root/invoices` | Invoices list |
| GET | `/api/root/invoices/[id]` | Invoice detail |
| POST | `/api/root/invoices/[id]/issue` | Issue invoice |
| POST | `/api/root/invoices/[id]/pay-link` | Generate payment link |
| POST | `/api/root/invoices/[id]/record-payment` | Record payment |
| POST | `/api/root/invoices/[id]/split` | Split invoice |
| POST | `/api/webhooks/stripe` | Stripe webhook handler |

## Related

- [[creative-brief]] — Quote generation from brief
- [[stripe-integration]] — Payment processing details
- [[client-portal]] — Client-facing quote/invoice views
- [[finance-control]] — Broader finance management
