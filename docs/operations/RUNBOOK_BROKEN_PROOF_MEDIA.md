# Runbook: Broken Proof Or Media

## Trigger

Use this runbook when the portfolio integrity audit reports:

1. missing local assets
2. invalid manifest metadata
3. stale or unreviewed proof entries
4. broken optional remote media URLs

## Diagnose

```bash
npm run ops:portfolio
```

Canonical manifest:

[`apps/home/lib/content/portfolio-manifest.json`](/Users/baileyeubanks/Desktop/Projects/contentco-op/monorepo/apps/home/lib/content/portfolio-manifest.json)

## Recovery

1. Fix missing asset paths or restore the asset under `apps/home/public`.
2. Repair invalid case-study metadata in the manifest.
3. Mark proof alignment accurately as `client_specific` or `shared_environment`.
4. Refresh `reviewedAt`, `reviewedBy`, and notes after confirming the entry is still correct.
5. Re-run `npm run ops:portfolio`.

## Exit Criteria

The portfolio report is healthy or only contains intentional non-blocking warnings.
