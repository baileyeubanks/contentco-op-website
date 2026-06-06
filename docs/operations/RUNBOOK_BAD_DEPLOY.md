# Runbook: Bad Deploy

## Trigger

Use this runbook when a fresh build or deploy regresses route availability, health, intake, or portfolio proof.

## Diagnose

```bash
npm run build -w @contentco-op/home
npm run start -w @contentco-op/home
npm run ops:audit
```

Check whether the failure is a real runtime regression or a publish-lag issue:

```bash
git rev-parse HEAD
curl -sS https://contentco-op.com/api/runtime-proof
curl -sS https://www.contentco-op.com/api/runtime-proof
```

If GitHub Actions is green but either runtime-proof endpoint reports an older
SHA, the site has not been activated on M4 yet. Run the canonical live publish:

```bash
npm run publish:live
```

Review the latest repo-local artifact in:

[`ops/reports`](/Users/baileyeubanks/Desktop/Projects/contentco-op/monorepo/ops/reports)

## Recovery

1. Identify the first failing surface in `ops:audit`.
2. If the failure is route-related, use the broken public route runbook.
3. If the failure is proof-related, use the broken proof/media runbook.
4. If the failure is intake-related, use the failed intake runbook.
5. If runtime proof is behind `HEAD`, run `npm run publish:live`.
6. Rebuild and re-run `npm run ops:audit`.

## Rollback Rule

Rollback is preferred when:

1. the public smoke check is critical
2. intake readiness is critical
3. the health endpoint returns `503`

## Exit Criteria

The repo builds, starts, passes `npm run ops:audit` against the intended target,
and both apex and `www` runtime-proof endpoints report the intended Git SHA.
