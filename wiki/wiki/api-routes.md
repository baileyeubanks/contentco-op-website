---
title: API Routes
created: 2026-04-30
updated: 2026-05-01
tags: [api, backend, routes, nextjs]
---

## Summary

The Content Co-op API surface consists of 40+ route handlers in `apps/home/app/api/`. Routes are organized by domain: auth, briefs, client, root, media, quotes, invoices, webhooks, and operations.

## Route Organization

```
app/api/
├── auth/
│   └── login/route.ts
├── briefs/
│   ├── route.ts                    # POST /api/briefs (legacy Supabase)
│   ├── [id]/route.ts               # GET brief detail
│   ├── [id]/files/route.ts         # File attachments
│   ├── [id]/messages/route.ts      # Brief messages
│   └── [id]/quote-draft/route.ts   # Generate quote draft
├── cco/
│   ├── briefs/route.ts             # POST /api/cco/briefs (Firebase)
│   ├── leads/route.ts              # POST /api/cco/leads
│   ├── bookings/route.ts           # POST /api/cco/bookings
│   ├── bookings/availability/route.ts
│   ├── firebase/status/route.ts
│   └── health/route.ts
├── chat/route.ts                   # Chat assistant
├── client/
│   ├── [token]/route.ts            # Portal data
│   ├── [token]/messages/route.ts
│   ├── portal/route.ts
│   ├── quote/[id]/route.ts
│   ├── quote/[id]/accept/route.ts
│   ├── quote/[id]/pay/route.ts
│   ├── quote/[id]/pay/confirm/route.ts
│   ├── estimate/[id]/route.ts
│   ├── estimate/[id]/decision/route.ts
│   ├── invoice/[id]/route.ts
│   ├── invoice/[id]/pay/route.ts
│   └── invoice/[id]/pay/confirm/route.ts
├── cron/invoice-reminders/route.ts
├── dashboard/route.ts
├── health/route.ts
├── media/
│   ├── hero/transcode/route.ts
│   ├── thumbnail/extract/route.ts
│   ├── thumbnail/approve/route.ts
│   └── thumbnail/approved/route.ts
├── operations/
│   ├── crew/route.ts
│   ├── crew/override/route.ts
│   ├── dispatch/route.ts
│   └── notifications/route.ts
├── platform/manifest/route.ts
├── quotes/
│   ├── route.ts
│   ├── [id]/route.ts
│   ├── [id]/convert/route.ts
│   ├── [id]/pdf/route.ts
│   └── [id]/preview/route.ts
├── root/
│   ├── login/route.ts
│   ├── overview/route.ts
│   ├── contacts/... (list, detail, timeline, relationships, enrich, import, merge, score)
│   ├── companies/... (list, detail)
│   ├── finance/... (overview, accounts, payables, reconciliation, rules, tax)
│   ├── quotes/... (list, detail, agreement, comments, duplicate, pdf, preview, views)
│   ├── invoices/... (list, detail, duplicate, issue, pay-link, payments, pdf, preview, record-payment, split, reminders, recurring)
│   ├── payments/... (list, detail)
│   ├── projects/... (list, detail, deliverables)
│   ├── campaigns/... (list, detail, contacts, performance)
│   ├── catalog/products-services/route.ts
│   ├── dispatch/jobs/route.ts
│   ├── handoffs/route.ts
│   ├── work-claims/... (list, release)
│   ├── goals/... (list, dispatch)
│   ├── agents/route.ts
│   ├── approvals/... (list, decision)
│   ├── automations/... (list, detail, test)
│   ├── marketing/... (overview, briefs)
│   ├── system/... (data, actions, phone-actions)
│   ├── system-map/route.ts
│   ├── workspace/... (data, health, import, imports, docs, drive/files, gcs/buckets, gcs/objects, sheets, slides)
│   ├── commercial/queues/route.ts
│   └── estimates/... (approve-gate, convert-to-invoice, decision, schedule-waiver, send)
├── share/
│   ├── quote/[id]/accept/route.ts
│   ├── quote/[id]/comment/route.ts
│   └── quote/[id]/view/route.ts
├── webhooks/stripe/route.ts
└── runtime-proof/route.ts
```

## Auth Patterns

- **Public routes**: No auth required (`/api/briefs`, `/api/cco/*`, `/api/client/*`)
- **CCO OS routes**: CCO OS session cookie required (`/api/os/*`)
- **Webhook routes**: Signature validation (`/api/webhooks/stripe`)

## Response Patterns

All API routes return JSON with consistent error shaping:
```typescript
{ success: boolean; data?: unknown; error?: { code: string; message: string } }
```

## Related

- [database-schema](database-schema.md) — Data layer
- [types-system](types-system.md) — TypeScript contracts
- [firebase-integration](firebase-integration.md) — CCO backend
- [stripe-integration](stripe-integration.md) — Payment webhooks


## Backlinks

- [[database-schema]]
- [[development-patterns]]
- [[firebase-integration]]
- [[index]]
- [[portfolio-system]]
- [[root-overview]]
- [[stripe-integration]]
- [[types-system]]

## Client links (S2, 2026-10-08)

CCO-DB resources are served only when business_unit is exactly CC; null is not CC. Quote/invoice links use record-typed, signed `cl1` capabilities in `?t=`, capped at 30 days. Bare IDs and invalid, expired or wrong-type links return the same 404 and a static service@contentco-op.com contact link. Tokens are verified before data access. `/client/portal` and `/api/client/portal` remain closed; `/client/[token]` requires at least 32 URL-safe characters and the entropy sanity check.

Operator copy/open/send requests a new link through the permission-gated share-link action; ordinary read endpoints and public pages do not mint it. The operator-triggered invoice reminder issues a signed URL and skips non-CC/null invoices. Portal row links and Stripe cancel links last seven days. Stripe success uses the static, no-data payment acknowledgement. Portal responses use share_url rather than a raw Stripe link. Quote pay and confirmation forward x-client-link.

Deployment is outside this source packet: merge after SF5 and the approved batch publish. Provision a runtime-owned regular key file (0600) and configure CCO_CLIENT_LINK_KEY_FILE as a path only. First key signs; all listed keys verify. Rotate yearly or on suspected leak as policy; actual rotation requires Bailey approval. Remove the retired environment signing secret in that approved window and restart. Bailey may re-send open-item links from CCO OS after deployment; no automatic re-send is authorized here. No migration is needed. Hashing portal tokens at rest is a separate packet.
