# API Contracts (MVP Stubs)

## Auth

1. `POST /api/auth/login`

## Content Co-op Public Intake

1. `POST /api/cco/leads`
   Notes:
   `Persists the lead contact to CCO-DB before the form can advance.`
2. `POST /api/cco/briefs`
   Notes:
   `Canonical public /brief submit route. Persists the CCO contact and creative brief, records client/admin email outcomes, and returns an opaque portal capability only after a database receipt.`
3. `POST /api/cco/briefs/proposal`
   Notes:
   `Requires the stored brief id and portal capability. Builds the proposal only from persisted scope, stores it on the brief, then reports it ready.`
4. `POST /api/cco/briefs/:id/deposit`
   Notes:
   `Explicitly unavailable until a canonical CCO payment rail can create an idempotent checkout and durable receipt.`
5. Legacy portal routes under `/api/briefs/:id/*` remain outside this public
   intake contract. They are not called by `/brief`, are not a CCO-DB-backed
   submission or proposal path, and require a separately approved migration or
   retirement before a broader public-portal release.

Legacy note: `POST /api/briefs` is retired with `410 Gone`. It must not be
used as a compatibility fallback for public intake.

Handoff contract:

1. Public funnel captures contact, scope, creative direction, production constraints, and booking intent.
2. CCO HOME is responsible only for public intake capture, booking/brief routing, portfolio proof, and client portal access.
3. CCO OS remains the downstream authority for contacts, proposals, quotes, and operational follow-up.
4. Public route notes:
   `GET /brief` is the canonical public intake route.
   `GET /book` remains a public contact surface, but online scheduling is explicitly unavailable until a canonical CCO booking receipt exists.
   `GET /cocreate` and `GET /onboard` remain compatibility aliases only.

CCO-DB public-intake baseline:

1. `creative_briefs` is the durable record. Public intake writes the flat portal fields plus the CCO fields established by `20260819000000_cco_public_brief_persistence.sql`: `company_account_id` and `data`.
2. `contacts.cco_public_email_key` is the lower-case literal identity key; CCO-DB enforces one CCO contact per key without wildcard email matching.
3. `data.public_submission_id` is the browser retry key; CCO-DB enforces one CCO brief per key.
4. `data.proposal.content` is the only proposal a public proposal page may render.
5. `notification_log` has one durable row per public brief, recipient, and delivery template. It records `sending`, provider-accepted `sent`, `failed`, or an explicit `unknown` delivery outcome. Recipient mailbox delivery/bounce confirmation requires provider-webhook reconciliation and is not inferred from `sent`.
6. `brief_status_history`, `brief_messages`, and `brief_files` remain live support tables for the public portal.

Structured handoff envelope:

1. CCO HOME normalizes the public brief before persistence.
2. `intake_payload`, `structured_intake`, and `handoff_payload` retain the complete CCO intake shape when available.
3. The durable `data` envelope includes the public submission id, contact receipt, structured project scope, and (only after successful storage) the generated proposal.
4. The public page never renders proposal JSON supplied in a URL or request body.

Create-now vs later:

1. Created now in CCO HOME:
   CCO contact, `creative_briefs` row, client portal capability, client receipt email log, and Bailey admin alert log.
2. Deferred to CCO OS-managed follow-through:
   booking pairing, quote generation, formal approval, and operational follow-up.

End-to-end blockers:

1. `booking_intent` is routing metadata only and does not create or confirm an appointment record.
2. A browser must see `persisted: true` from CCO-DB before it may show a received state or request a proposal.
3. A proposal must be stored before the browser may navigate to its proposal page. Deposit checkout remains disabled pending the canonical payment rail.
4. Any CCO-DB schema change used by the public route must land as an explicit CCO migration before its runtime release.

## Co-Cut

Legacy compatibility note: route namespaces remain `/api/coedit/*` until dependents are fully migrated.

1. `GET /api/coedit/projects`
2. `GET /api/coedit/assets/:id`
3. `POST /api/coedit/assets/:id/versions`
4. `POST /api/coedit/comments`
5. `PATCH /api/coedit/comments/:id`
6. `POST /api/coedit/approvals/:gateId/decision`
7. `GET /api/coedit/assets/:id/audit-log`

## Co-Script

1. `POST /api/coscript/watchlists`
2. `POST /api/coscript/watchlists/:id/sync`
3. `GET /api/coscript/outliers`
4. `POST /api/coscript/briefs`
5. `POST /api/coscript/scripts/generate`
6. `POST /api/coscript/scripts/:id/fix`
7. `GET /api/coscript/scripts/:id/history`
8. `POST /api/coscript/vault/save`

## Media

1. `POST /api/media/hero/transcode`
2. `POST /api/media/thumbnail/extract`
3. `POST /api/media/thumbnail/approve`
4. `GET /api/media/thumbnail/approved?surface=home`

## Runtime Health

1. `GET /api/health`
   Notes:
   `Returns the repo-local health contract for the Content Co-op monorepo surface, including portfolio manifest validity, asset integrity, route readiness, runtime env readiness, and creative-brief intake readiness.`
2. `GET /api/health?scope=local`
   Notes:
   `Returns the same repo-local contract without external dependency probes.`

## Notes

1. Handlers are currently deterministic stubs and session-gated.
2. Production integration target: Supabase tables in `infra/supabase/migrations/20260224_content_coop_v21.sql`.
3. Queue execution target: `services/orchestrator` and `services/media-worker`.
