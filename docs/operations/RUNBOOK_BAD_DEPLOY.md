# Runbook: Bad Deploy

## Trigger

Use this runbook when a fresh build or deploy regresses route availability, health, intake, or portfolio proof.

## Diagnose

```bash
npm run build -w @contentco-op/home
npm run start -w @contentco-op/home
npm run ops:audit
```

Review the latest repo-local artifact in:

[`ops/reports`](/Users/baileyeubanks/Desktop/Projects/contentco-op/monorepo/ops/reports)

## Recovery

1. Identify the first failing surface in `ops:audit`.
2. If the failure is route-related, use the broken public route runbook.
3. If the failure is proof-related, use the broken proof/media runbook.
4. If the failure is intake-related, use the failed intake runbook.
5. Rebuild and re-run `npm run ops:audit`.

## Rollback Rule

Rollback is preferred when:

1. the public smoke check is critical
2. intake readiness is critical
3. the health endpoint returns `503`

## Exit Criteria

The repo builds, starts, and passes `npm run ops:audit` against the intended target.
