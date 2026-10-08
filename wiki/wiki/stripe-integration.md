---
title: Stripe Integration
created: 2026-04-30
updated: 2026-10-08
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

### Quote Deposit

1. A valid CC quote capability authorizes the public acceptance action.
2. POST /api/client/quote/[id]/pay forwards x-client-link, verifies before DB/Stripe and resolves the immutable CC frozen deposit amount.
3. The client PaymentElement receives a PaymentIntent; its return_url retains the verified page capability.
4. Confirmation verifies the quote capability, matching succeeded PaymentIntent metadata and CC invoice/estimate before applying payment.

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

## Client links (S2, 2026-10-08)

CCO-DB resources are served only when business_unit is exactly CC; null is not CC. Quote/invoice links use record-typed, signed `cl1` capabilities in `?t=`, capped at 30 days. Bare IDs and invalid, expired or wrong-type links return the same 404 and a static service@contentco-op.com contact link. Tokens are verified before data access. `/client/portal` and `/api/client/portal` remain closed; `/client/[token]` requires at least 32 URL-safe characters and the entropy sanity check.

Operator copy/open/send requests a new link through the permission-gated share-link action; ordinary read endpoints and public pages do not mint it. The operator-triggered invoice reminder issues a signed URL and skips non-CC/null invoices. Portal row links and Stripe cancel links last seven days. Stripe success uses the static, no-data payment acknowledgement. Portal responses use share_url rather than a raw Stripe link. Quote pay and confirmation forward x-client-link.

Deployment is outside this source packet: merge after SF5 and the approved batch publish. Provision the runtime-owned regular key file (0600) at the absolute expansion of `~/.config/blaze-secrets/cco-website/client-link.key`; configure CCO_CLIENT_LINK_KEY_FILE as a path only. See docs/CCO_CLIENT_LINK_DEPLOYMENT.md for the operator handoff. First key signs; all listed keys verify. Rotate yearly or on suspected leak as policy; actual rotation requires Bailey approval. Remove the retired environment signing secret in that approved window and restart. Bailey may re-send open-item links from CCO OS after deployment; no automatic re-send is authorized here. No migration is needed. Hashing portal tokens at rest is a separate packet.
