# Content Co-op Monorepo Runtime Contract

Last updated: 2026-03-13

## Scope

This document applies only to `/Users/baileyeubanks/Desktop/Projects/contentco-op/monorepo`.

## Canonical Commands

Development:

```bash
npm install
npm run dev:home
```

Build and start:

```bash
npm run build -w @contentco-op/home
npm run start -w @contentco-op/home
```

Repo-owned operations checks:

```bash
npm run ops:portfolio
npm run ops:routes
npm run ops:intake
npm run ops:drift
npm run ops:audit
```

## Required Runtime Env

Required:

1. `NEXT_PUBLIC_SUPABASE_URL`
2. `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. `SUPABASE_SERVICE_KEY`
4. `CCO_SESSION_SECRET`

Optional integrations:

1. `BLAZE_API_URL` or `BLAZE_API_BASE_URL`
2. `DEER_API_BASE_URL`
3. `DEER_HEALTH_URL`
4. `ALLOW_PRIVATE_RUNTIME_TARGETS`

Canonical template:

[`/.env.local.example`](/Users/baileyeubanks/Desktop/Projects/contentco-op/monorepo/.env.local.example)

## Health Surfaces

1. `GET /api/health`
2. `GET /api/health?scope=local`
3. Compatibility alias: `GET /cco/health`

Health payload fields:

1. `service`
2. `scope`
3. `status`
4. `generatedAt`
5. `version`
6. `summary`
7. `checks`

Repo-local checks cover:

1. portfolio manifest validity
2. portfolio asset integrity
3. public route source presence
4. runtime env readiness
5. creative brief intake readiness
6. dependency reachability when `scope=full`

## Smoke Expectations

1. `/` returns `200` and renders the homepage headline.
2. `/portfolio` returns `200` and renders the portfolio headline.
3. `/book` returns `200` and renders `Book a Strategy Call`.
4. `/brief` returns `200` and renders `Creative brief`.
5. `/login` returns `200` and renders `Client Login`.
6. `/api/health?scope=local` returns JSON with `service: "contentco-op-monorepo"`.

## Operational Artifacts

Automation artifacts are written to:

[`ops/reports`](/Users/baileyeubanks/Desktop/Projects/contentco-op/monorepo/ops/reports)

Every report must include:

1. summary
2. severity
3. affected surface
4. recommended next action
5. per-check details

## Rollback Criteria

Rollback or stop-the-line is required when:

1. `npm run ops:routes` is critical on the intended target.
2. `npm run ops:intake` is critical.
3. `npm run ops:portfolio` reports missing assets or invalid manifest IDs.
4. `GET /api/health` returns `503` because repo-local checks are failing.

## Default Recovery Order

1. Restore public route availability.
2. Restore intake readiness.
3. Restore portfolio proof integrity.
4. Re-run `npm run ops:audit`.
