# API Contracts (MVP Stubs)

## Auth

1. `POST /api/auth/login`

## Content Co-op Public Intake

1. `POST /api/onboard/chat`
   Notes:
   `Used by the public voice-brief assistant on /brief to extract structured intake fields before submission.`
2. `POST /api/briefs`
   Notes:
   `Canonical public creative-brief submit route for CCO HOME. Persists the public intake record, emits the versioned ROOT handoff envelope into the event bridge, and may invoke OpenClaw for internal follow-up guidance.`
3. `GET /api/briefs/:id?token=...`
   Notes:
   `Fetches the public portal brief record and status history for the client-facing portal.`
4. `GET /api/briefs/:id/messages?token=...`
5. `POST /api/briefs/:id/messages?token=...`
6. `GET /api/briefs/:id/files?token=...`
7. `POST /api/briefs/:id/files?token=...`

Handoff contract:

1. Public funnel captures contact, scope, creative direction, production constraints, and booking intent.
2. CCO HOME is responsible only for public intake capture, booking/brief routing, portfolio proof, and client portal access.
3. ROOT remains the downstream authority for contacts, proposals, quotes, and operational follow-up.
4. Public route notes:
   `GET /brief` is the canonical public intake route.
   `GET /book` remains available as the booking resolution reached from the brief flow.
   `GET /cocreate` and `GET /onboard` remain compatibility aliases only.

Live shared baseline:

1. `creative_briefs` is the live stored record. The homepage must only write columns that exist in the onboarding baseline migrations:
   `contact_name`, `contact_email`, `phone`, `company`, `role`, `location`, `content_type`, `deliverables`, `audience`, `tone`, `deadline`, `objective`, `key_messages`, `references`, `constraints`, plus the platform defaults (`id`, `access_token`, `status`, timestamps).
2. `brief_status_history`, `brief_messages`, and `brief_files` are live support tables for the public portal.
3. `events.payload` is the live shared bridge for richer structured handoff into ROOT-managed follow-through.
4. Richer intake structures may be derived in app code, but they are not assumed to be durable `creative_briefs` columns until the shared baseline actually grows.

Structured handoff envelope:

1. CCO HOME may normalize the public brief into a structured payload in memory.
2. The structured payload is emitted through `events.payload`, not stored as extra columns on `creative_briefs`.
3. The handoff envelope may include:
   `version`, `event_type`, `target`, `brief_id`, `portal_url`, `booking_url`, `intake`, `brief`, `structured_intake`, `root_handoff`.
4. This richer envelope is a handoff contract, not proof that those fields exist as live shared tables or columns.

Create-now vs later:

1. Created now in CCO HOME:
   `creative_briefs` row, client portal token, `events` bridge record, optional OpenClaw advisory.
2. Deferred to ROOT-managed follow-through:
   contact match/create, booking pairing, quote generation, proposal generation, operational follow-up.

End-to-end blockers:

1. `booking_intent` is routing metadata only. It is not persisted on the live `creative_briefs` row today, and it does not create or confirm an appointment record.
2. Quote/proposal readiness must be derived from the live flat brief fields or from the event handoff, not from assumed extra columns.
3. The public brief can start quote follow-through only when the live row has enough scope signal; otherwise ROOT or humans must collect the missing fields.
4. Any future structured-intake persistence must land as an explicit shared-baseline migration before runtime code depends on it.

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
