---
title: Client Portal
created: 2026-04-30
updated: 2026-10-08
tags: [product, client-portal, quotes, invoices]
---

## Routes and authorization

CCO uses CCO-DB. `/client/[token]` resolves an acceptable opaque `contacts.portal_token` only for a CC contact. The API returns minimal CC quote/invoice/payment rows and typed seven-day share URLs. `/client/portal` always returns 404; `/api/client/portal` is absent.

| Route | Authorization / behavior |
|---|---|
| `/client/quote/[id]?t=...` | Verified quote capability before reads; same token passed to payment/acceptance |
| `/share/quote/[id]?t=...` | Verified quote capability; CC-only quote and minimal props |
| `/share/invoice/[id]?t=...` | Verified invoice capability; CC-only document/payment paths |
| `GET /api/client/[token]` | Acceptable opaque portal token, exact CC contact, minimal rows with share_url |
| `GET/POST /api/client/[token]/messages` | Same portal checks; generic failure body |
| `POST /api/share/quote/[id]/accept` | Quote capability records acceptance/rejection/requested changes |
| `GET/POST /api/share/quote/[id]/comment` | Quote capability and CC parent |
| `POST /api/share/quote/[id]/view` | Quote capability and CC parent |
| `POST /api/client/quote/[id]/pay` | Quote capability; agreement and frozen CC amount required; CC deposit invoice |
| `POST /api/client/quote/[id]/pay/confirm` | Quote capability; matched succeeded PaymentIntent plus CC invoice/estimate |
| `POST /api/client/quote/[id]/accept` | Legacy operator-only quote_manage session, CC-only; not the public acceptance path |

Unused quote/estimate/invoice GET JSON endpoints and invoice pay-confirm are removed. X2 invoice pay is an untouched compatibility file on this slot's base and awaits hotfix #18/SF5 closure; client flows use the token-gated OS invoice pay-link route.

Opaque portal tokens have no new expiration mechanism in S2; hashing/storage migration is deferred. Signed record capabilities use cl1 format with type, id and expiry binding. Old bare IDs and weak opaque tokens reach the static service@ grace page.

## Related

- [quote-invoice-system](quote-invoice-system.md)
- [stripe-integration](stripe-integration.md)
- [api-routes](api-routes.md)

## Client links (S2, 2026-10-08)

CCO-DB resources are served only when business_unit is exactly CC; null is not CC. Quote/invoice links use record-typed, signed `cl1` capabilities in `?t=`, capped at 30 days. Bare IDs and invalid, expired or wrong-type links return the same 404 and a static service@contentco-op.com contact link. Tokens are verified before data access. `/client/portal` and `/api/client/portal` remain closed; `/client/[token]` requires at least 32 URL-safe characters and the entropy sanity check.

Operator copy/open/send requests a new link through the permission-gated share-link action; ordinary read endpoints and public pages do not mint it. The operator-triggered invoice reminder issues a signed URL and skips non-CC/null invoices. Portal row links and Stripe cancel links last seven days. Stripe success uses the static, no-data payment acknowledgement. Portal responses use share_url rather than a raw Stripe link. Quote pay and confirmation forward x-client-link.

Deployment is outside this source packet: merge after SF5 and the approved batch publish. Provision a runtime-owned regular key file (0600) and configure CCO_CLIENT_LINK_KEY_FILE as a path only. First key signs; all listed keys verify. Rotate yearly or on suspected leak as policy; actual rotation requires Bailey approval. Remove the retired environment signing secret in that approved window and restart. Bailey may re-send open-item links from CCO OS after deployment; no automatic re-send is authorized here. No migration is needed. Hashing portal tokens at rest is a separate packet.
