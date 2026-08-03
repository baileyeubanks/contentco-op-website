---
title: Stripe Integration
created: 2026-04-30
updated: 2026-05-01
tags: [stripe, payments, billing, finance]
---

## Summary

Stripe handles all payment processing for Content Co-op: quote deposits, invoice payments, and recurring billing. Integration via `@stripe/stripe-js` on the client and `stripe` Node SDK on the server.

## Configuration

Environment variables:
```
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

## Payment Flows

### Quote Deposit (50%)

1. Client accepts quote → `POST /api/client/quote/[id]/accept`
2. System creates Stripe Checkout Session for 50% deposit
3. Client redirected to Stripe
4. Payment confirmed via webhook `POST /api/webhooks/stripe`
5. Project status updated to "deposit_received"
6. Calendar hold created for kickoff

### Invoice Payment

1. Invoice issued → `POST /api/os/invoices/[id]/issue`
2. Payment link generated → `POST /api/os/invoices/[id]/pay-link`
3. Client pays via Stripe Checkout
4. Webhook confirms payment
5. `POST /api/os/invoices/[id]/record-payment` updates ledger

### Split Payments

Large invoices can be split into multiple payments:
- `POST /api/os/invoices/[id]/split`
- Each split generates its own Stripe Checkout Session
- Payments tracked individually in `invoice_payments`

## Webhook Handler

`POST /api/webhooks/stripe`:
- Validates Stripe signature
- Handles `checkout.session.completed`
- Handles `invoice.paid`
- Handles `payment_intent.succeeded`
- Emits Blaze handoff for email confirmations

## Quote-to-Invoice Conversion

`POST /api/quotes/[id]/convert`:
1. Copies quote items to invoice items
2. Sets due date (net-15 by default)
3. Generates invoice PDF
4. Creates Stripe payment intent

## Related

- [quote-invoice-system](quote-invoice-system.md) — Full commercial pipeline
- [client-portal](client-portal.md) — Client-facing payments
- [finance-control](finance-control.md) — Accounting reconciliation
- [api-routes](api-routes.md) — All payment endpoints


## Backlinks

- [[api-routes]]
- [[client-portal]]
- [[creative-brief]]
- [[finance-control]]
- [[index]]
- [[quote-invoice-system]]
