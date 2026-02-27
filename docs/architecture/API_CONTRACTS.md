# API Contracts (MVP Stubs)

## Auth

1. `POST /api/auth/login`

## Co-Edit

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

## Notes

1. Handlers are currently deterministic stubs and session-gated.
2. Production integration target: Supabase tables in `infra/supabase/migrations/20260224_content_coop_v21.sql`.
3. Queue execution target: `services/orchestrator` and `services/media-worker`.

